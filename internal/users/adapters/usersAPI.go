package adapters

import (
	"golang.org/x/crypto/bcrypt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	auth "github.com/edlingao/go-auth/auth/core"
	"github.com/edlingao/hexago/internal/users/core"
	"github.com/edlingao/hexago/internal/users/ports"
	"github.com/labstack/echo/v4"
)

func insertUser(username, password, email, firstName, lastName, avatarURL string) (core.User, error) {
	db, err := ConnectDB()
	if err != nil {
		return core.User{}, err
	}
	defer db.Close()

	// Enforce unique username/email at app level
	var exists int
	q1 := db.Rebind(`SELECT 1 FROM users WHERE username = ? LIMIT 1`)
	if err := db.Get(&exists, q1, username); err == nil && exists == 1 {
		return core.User{}, echo.NewHTTPError(409, "Username already exists")
	}
	if email != "" {
		q2 := db.Rebind(`SELECT 1 FROM users WHERE email = ? LIMIT 1`)
		if err := db.Get(&exists, q2, email); err == nil && exists == 1 {
			return core.User{}, echo.NewHTTPError(409, "Email already exists")
		}
	}

	// Insert and return row
	q := db.Rebind(`
		INSERT INTO users (username, password, email, first_name, last_name, avatar_url)
		VALUES (?, ?, ?, ?, ?, ?)
		RETURNING id, username, password, email, first_name, last_name, avatar_url
	`)
	var row struct {
		ID        int64  `db:"id"`
		Username  string `db:"username"`
		Password  string `db:"password"`
		Email     string `db:"email"`
		FirstName string `db:"first_name"`
		LastName  string `db:"last_name"`
		AvatarURL string `db:"avatar_url"`
	}
	if err := db.Get(&row, q, username, password, email, firstName, lastName, avatarURL); err != nil {
		return core.User{}, err
	}

	return core.User{
		ID:        strconv.FormatInt(row.ID, 10),
		Username:  row.Username,
		Password:  row.Password,
		Email:     row.Email,
		FirstName: row.FirstName,
		LastName:  row.LastName,
		AvatarURL: row.AvatarURL,
	}, nil
}

func resolveUsername(identifier string) string {
	// If the user typed an email, try to map to the stored username.
	if !strings.Contains(identifier, "@") {
		return identifier
	}
	db, err := ConnectDB()
	if err != nil {
		return identifier
	}
	defer db.Close()

	var uname string
	if err := db.Get(&uname, db.Rebind(`SELECT username FROM users WHERE email = ? LIMIT 1`), identifier); err != nil {
		return identifier
	}
	if uname == "" {
		return identifier
	}
	return uname
}

func setProfileFields(userID string, email, firstName, lastName, avatarURL string) {
	// Best-effort update; ignore errors for now.
	db, err := ConnectDB()
	if err != nil {
		return
	}
	defer db.Close()

	_, _ = db.Exec(`
		UPDATE users
		SET email = COALESCE(NULLIF(?, ''), email),
		    first_name = COALESCE(NULLIF(?, ''), first_name),
		    last_name = COALESCE(NULLIF(?, ''), last_name),
		    avatar_url = COALESCE(NULLIF(?, ''), avatar_url)
		WHERE id = ?
	`, email, firstName, lastName, avatarURL, userID)
}

type UsersAPIService struct {
	dbService      ports.StoringUsers
	httpService    *echo.Group
	sessionService auth.SessionService
	usersService   ports.UserServiceMethods
	secret         string
}

type SignInResponse struct {
	User  core.User `json:"user"`
	Token string    `json:"token"`
}

func NewUsersAPIService(
	dbService ports.StoringUsers,
	httpService *echo.Group,
	sessionService auth.SessionService,
	usersService ports.UserServiceMethods,
) *UsersAPIService {

	secret := os.Getenv("JWT_SECRET")

	uApiService := &UsersAPIService{
		dbService:      dbService,
		httpService:    httpService,
		sessionService: sessionService,
		usersService:   usersService,
		secret:         secret,
	}

	uApiService.httpService.POST("/signin", uApiService.SignIn)
	uApiService.httpService.POST("/signup", uApiService.SignUp)
	uApiService.httpService.POST("/logout", uApiService.Logout)

	// Protected routes
	protected := uApiService.httpService.Group("", sessionService.APIAuth)
	protected.GET("/all", uApiService.GetAllUsers)

	return uApiService
}

func (uas *UsersAPIService) GetAllUsers(c echo.Context) error {
	users := uas.dbService.GetAll("users")

	return c.JSON(200, ports.Response[[]core.User]{
		Status:  200,
		Message: "Success",
		Data:    users,
	})
}

func (uas *UsersAPIService) SignIn(c echo.Context) error {
	identifier := strings.TrimSpace(c.FormValue("username"))
	password := c.FormValue("password")

	if identifier == "" || password == "" {
		return c.JSON(400, ports.Response[any]{
			Status:  400,
			Message: "Username and password are required",
		})
	}

	uname := resolveUsername(identifier)

	// First try the existing user service
	user, err := uas.usersService.SignIn(uname, password)

	// Fallback for demo seeds: support plaintext passwords (and bcrypt if present)
	if err != nil {
		db, derr := ConnectDB()
		if derr == nil {
			defer db.Close()

			var row struct {
				ID        int    `db:"id"`
				Username  string `db:"username"`
				Password  string `db:"password"`
				Email     string `db:"email"`
				FirstName string `db:"first_name"`
				LastName  string `db:"last_name"`
				AvatarURL string `db:"avatar_url"`
			}

			qerr := db.Get(&row, db.Rebind(`SELECT id, username, password, email, first_name, last_name, avatar_url FROM users WHERE username = ? LIMIT 1`), uname)
			if qerr == nil {
				ok := false
				if strings.HasPrefix(row.Password, "$2a$") || strings.HasPrefix(row.Password, "$2b$") || strings.HasPrefix(row.Password, "$2y$") {
					ok = bcrypt.CompareHashAndPassword([]byte(row.Password), []byte(password)) == nil
				} else {
					ok = row.Password == password
				}

				if ok {
					user = core.User{
						ID:        strconv.Itoa(row.ID),
						Username:  row.Username,
						Email:     row.Email,
						FirstName: row.FirstName,
						LastName:  row.LastName,
						AvatarURL: row.AvatarURL,
					}
					err = nil
				}
			}
		}
	}

	if err != nil {
		return c.JSON(401, ports.Response[any]{
			Status:  401,
			Message: "Invalid username or password",
		})
	}

	token, err := uas.sessionService.Create(user.ID, user.Username, uas.secret)
	if err != nil {
		log.Println(user.ID, user.Username, uas.secret, err)
		return c.JSON(500, ports.Response[any]{
			Status:  500,
			Message: err.Error(),
		})
	}

	// Set session token cookie (HttpOnly)
	cookie := new(http.Cookie)
	cookie.Name = "session_token"
	cookie.Value = token.Token
	cookie.Path = "/"
	cookie.HttpOnly = true
	cookie.SameSite = http.SameSiteLaxMode
	cookie.Expires = time.Now().Add(7 * 24 * time.Hour)
	cookie.MaxAge = 60 * 60 * 24 * 7
	if os.Getenv("ENV") == "production" {
		cookie.Secure = true
	}
	c.SetCookie(cookie)

	return c.JSON(200, ports.Response[SignInResponse]{
		Status:  200,
		Message: "User signed in",
		Data: SignInResponse{
			User:  user,
			Token: token.Token,
		},
	})
}

func (uas *UsersAPIService) SignUp(c echo.Context) error {
	username := strings.TrimSpace(c.FormValue("username"))
	password := c.FormValue("password")
	email := strings.TrimSpace(c.FormValue("email"))
	firstName := strings.TrimSpace(c.FormValue("firstName"))
	lastName := strings.TrimSpace(c.FormValue("lastName"))
	avatarUrl := strings.TrimSpace(c.FormValue("avatarUrl"))

	if username == "" || password == "" {
		return c.JSON(400, ports.Response[any]{Status: 400, Message: "Username and password are required"})
	}
	if email != "" && !strings.Contains(email, "@") {
		return c.JSON(400, ports.Response[any]{Status: 400, Message: "Invalid email"})
	}

	user, err := insertUser(username, password, email, firstName, lastName, avatarUrl)
	if err != nil {
		// Handle 409 from echo HTTPError
		if he, ok := err.(*echo.HTTPError); ok {
			code := he.Code
			msg := "Signup failed"
			if s, ok := he.Message.(string); ok {
				msg = s
			}
			return c.JSON(code, ports.Response[any]{Status: code, Message: msg})
		}
		return c.JSON(500, ports.Response[any]{Status: 500, Message: err.Error()})
	}

	token, err := uas.sessionService.Create(user.ID, user.Username, uas.secret)
	if err != nil {
		return c.JSON(500, ports.Response[any]{Status: 500, Message: err.Error()})
	}

	// Set session token cookie (HttpOnly)
	cookie := new(http.Cookie)
	cookie.Name = "session_token"
	cookie.Value = token.Token
	cookie.Path = "/"
	cookie.HttpOnly = true
	cookie.SameSite = http.SameSiteLaxMode
	cookie.Expires = time.Now().Add(7 * 24 * time.Hour)
	cookie.MaxAge = 60 * 60 * 24 * 7
	if os.Getenv("ENV") == "production" {
		cookie.Secure = true
	}
	c.SetCookie(cookie)

	return c.JSON(200, ports.Response[SignInResponse]{
		Status:  200,
		Message: "User registered",
		Data: SignInResponse{
			User:  user,
			Token: token.Token,
		},
	})
}

func (uas *UsersAPIService) Logout(c echo.Context) error {
	// token from cookie session_token, Authorization: Bearer, or X-Session-Token
	token := ""
	if ck, err := c.Cookie("session_token"); err == nil {
		token = ck.Value
	}
	if token == "" {
		authz := c.Request().Header.Get("Authorization")
		if strings.HasPrefix(authz, "Bearer ") {
			token = strings.TrimSpace(strings.TrimPrefix(authz, "Bearer "))
		}
	}
	if token == "" {
		token = strings.TrimSpace(c.Request().Header.Get("X-Session-Token"))
	}

	// Best-effort delete session row
	if token != "" {
		db, err := ConnectDB()
		if err == nil {
			defer db.Close()
			_, _ = db.Exec(db.Rebind(`DELETE FROM sessions WHERE token = ?`), token)
		}
	}

	// Expire cookie
	secure := os.Getenv("ENV") == "production"
	c.SetCookie(&http.Cookie{
		Name:     "session_token",
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		Expires:  time.Unix(0, 0),
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   secure,
	})

	return c.JSON(200, map[string]any{"ok": true})
}
