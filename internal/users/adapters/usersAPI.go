package adapters

import (
	"log"
	"net/http"
	"os"
	"time"

	auth "github.com/edlingao/go-auth/auth/core"
	"github.com/edlingao/hexago/internal/users/core"
	"github.com/edlingao/hexago/internal/users/ports"
	"github.com/labstack/echo/v4"
)

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
	username := c.FormValue("username")
	password := c.FormValue("password")

	if username == "" || password == "" {
		return c.JSON(400, ports.Response[any]{
			Status:  400,
			Message: "Username and password are required",
		})
	}

	user, err := uas.usersService.SignIn(username, password)

	if err != nil {
		return c.JSON(500, ports.Response[any]{
			Status:  500,
			Message: err.Error(),
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

	// Set session token cookie (HttpOnly). Browser will send it automatically on same-origin requests.
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
	username := c.FormValue("username")
	password := c.FormValue("password")
	err := uas.usersService.Register(username, password)

	if err != nil {
		return c.JSON(500, ports.Response[any]{
			Status:  500,
			Message: err.Error(),
		})
	}

	user, err := uas.usersService.GetByUsername(username)

	if err != nil {
		return c.JSON(500, ports.Response[any]{
			Status:  500,
			Message: err.Error(),
		})
	}

	token, err := uas.sessionService.Create(user.ID, user.Username, uas.secret)

	if err != nil {
		return c.JSON(500, ports.Response[any]{
			Status:  500,
			Message: err.Error(),
		})
	}

	// Set session token cookie (HttpOnly). Browser will send it automatically on same-origin requests.
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
