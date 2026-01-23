package adapters

import (
	"errors"
	"net/http"
	"os"
	"time"

	authCore "github.com/edlingao/go-auth/auth/core"
	"github.com/edlingao/hexago/common/delivery/web"
	"github.com/edlingao/hexago/internal/users/ports"
	"github.com/edlingao/hexago/web/views/admin"
	"github.com/edlingao/hexago/web/views/auth"
	"github.com/edlingao/hexago/web/views/scanner"
	"github.com/edlingao/hexago/web/views/users"
	"github.com/labstack/echo/v4"
	"strings"
)

type UsersWebService struct {
	URL            string
	http           *echo.Group
	sessionService authCore.SessionService
	usersService   ports.UserServiceMethods
	dbService      ports.StoringUsers
}

func NewUsersWebService(
	url string,
	httpService *echo.Group,
	sessionService authCore.SessionService,
	dbService ports.StoringUsers,
	usersService ports.UserServiceMethods,
) *UsersWebService {

	usersWebService := &UsersWebService{
		URL:            url,
		http:           httpService,
		sessionService: sessionService,
		dbService:      dbService,
		usersService:   usersService,
	}
	// Public routes
	usersWebService.http.GET("/login", usersWebService.LoginView)
	usersWebService.http.GET("/signup", usersWebService.SignUp)
	usersWebService.http.POST("/login", usersWebService.LoginEndpoint)
	usersWebService.http.POST("/register", usersWebService.SignUpEndpoint)

	// Mock views (public for development - uses Alpine.js localStorage auth)
	usersWebService.http.GET("/dashboard", usersWebService.Dashboard)
	usersWebService.http.GET("/choose-plan", usersWebService.ChoosePlan)
	usersWebService.http.GET("/history", usersWebService.History)
	usersWebService.http.GET("/account", usersWebService.Account)
	usersWebService.http.GET("/qr-code", usersWebService.QRCode)
	usersWebService.http.GET("/scanner", usersWebService.Scanner)
	usersWebService.http.GET("/admin/portal", usersWebService.AdminPortal)

	// Protected routes
	protectedAPI := usersWebService.http.Group("", sessionService.APIAuth)
	protectedAPI.GET("/all", usersWebService.GetAllUsers)

	return usersWebService
}

func (uws *UsersWebService) GetAllUsers(c echo.Context) error {
	return nil
}

func (uws *UsersWebService) LoginView(c echo.Context) error {
	return web.Render(
		c,
		auth.Login(auth.LoginVM{}),
		200,
	)
}

func (uws *UsersWebService) SignUp(c echo.Context) error {
	return web.Render(
		c,
		auth.Register(auth.RegisterVM{}),
		200,
	)
}

func (uws *UsersWebService) LoginEndpoint(c echo.Context) error {
	username := c.FormValue("username")
	password := c.FormValue("password")

	user, err := uws.usersService.SignIn(username, password)

	if err != nil {
		return web.Render(
			c,
			auth.SignIn(auth.SignInVM{
				Error: err,
			}),
			400,
		)
	}

	token, err := uws.sessionService.Create(user.ID, user.Username, os.Getenv("JWT_SECRET"))

	if err != nil {
		return web.Render(
			c,
			auth.SignIn(auth.SignInVM{
				Error: err,
			}),
			500,
		)
	}
	cookie := uws.SetCookie(token.Token, c)
	c.SetCookie(cookie)
	c.Response().Header().Set("HX-Location", "/dashboard")

	return web.Render(
		c,
		auth.SignIn(auth.SignInVM{}),
		200,
	)
}

func (uws *UsersWebService) SignUpEndpoint(c echo.Context) error {
	username := c.FormValue("username")
	password := c.FormValue("password")
	if username == "" || password == "" {
		return web.Render(
			c,
			auth.SignIn(auth.SignInVM{
				Error: errors.New("Username and password are required"),
			}),
			400,
		)
	}

	err := uws.usersService.Register(username, password)
	if err != nil {
		return web.Render(
			c,
			auth.SignIn(auth.SignInVM{
				Error: err,
			}),
			400,
		)
	}

	user, err := uws.usersService.GetByUsername(username)
	if err != nil {
		return web.Render(
			c,
			auth.SignIn(auth.SignInVM{
				Error: err,
			}),
			400,
		)
	}

	token, err := uws.sessionService.Create(user.ID, user.Username, os.Getenv("JWT_SECRET"))
	if err != nil {
		return web.Render(
			c,
			auth.SignIn(auth.SignInVM{
				Error: err,
			}),
			500,
		)
	}

	cookie := uws.SetCookie(token.Token, c)
	c.SetCookie(cookie)

	c.Response().Header().Set("HX-Location", "/dashboard")

	return web.Render(
		c,
		auth.SignIn(auth.SignInVM{}),
		200,
	)

}

func (uws *UsersWebService) requireStaffRole(c echo.Context) (bool, int64) {
	db, err := ConnectDB()
	if err != nil {
		return false, 0
	}
	defer db.Close()

	// token from cookie session_token, Authorization: Bearer, or X-Session-Token
	token := ""
	if ck, err := c.Cookie("session_token"); err == nil {
		token = ck.Value
	}
	if token == "" {
		auth := c.Request().Header.Get("Authorization")
		if strings.HasPrefix(auth, "Bearer ") {
			token = strings.TrimSpace(strings.TrimPrefix(auth, "Bearer "))
		}
	}
	if token == "" {
		token = strings.TrimSpace(c.Request().Header.Get("X-Session-Token"))
	}
	if token == "" {
		return false, 0
	}

	var uid int64
	q := db.Rebind(`SELECT user_id FROM sessions WHERE token = ? LIMIT 1`)
	if err := db.Get(&uid, q, token); err != nil {
		return false, 0
	}

	var role string
	q2 := db.Rebind(`SELECT role FROM users WHERE id = ? LIMIT 1`)
	if err := db.Get(&role, q2, uid); err != nil {
		return false, 0
	}

	if role != "admin" && role != "attendant" {
		return false, uid
	}
	return true, uid
}

func (uh UsersWebService) SetCookie(key string, c echo.Context) *http.Cookie {
	secure := os.Getenv("ENVIRONMENT") == "prod"
	cookie := &http.Cookie{
		Name:     "Auth",
		Value:    key,
		Expires:  time.Now().Add(24 * time.Hour),
		HttpOnly: true,
		Secure:   secure, // Set to true in production with HTTPS
		SameSite: http.SameSiteLaxMode,
		Path:     "/",
	}

	return cookie
}

func (uws *UsersWebService) Dashboard(c echo.Context) error {
	return web.Render(
		c,
		users.Dashboard(users.DashboardVM{}),
		200,
	)
}

func (uws *UsersWebService) QRCode(c echo.Context) error {
	return web.Render(
		c,
		users.QRCode(users.QRCodeVM{}),
		200,
	)
}

func (uws *UsersWebService) Scanner(c echo.Context) error {

	ok, uid := uws.requireStaffRole(c)
	if !ok {
		if uid == 0 {
			return c.Redirect(302, "/login")
		}
		return c.Redirect(302, "/dashboard")
	}

	return web.Render(
		c,
		scanner.Scanner(scanner.ScannerVM{}),
		200,
	)
}

func (uws *UsersWebService) AdminPortal(c echo.Context) error {
	return web.Render(
		c,
		admin.Portal(admin.PortalVM{}),
		200,
	)
}

func (uws *UsersWebService) History(c echo.Context) error {
	return web.Render(
		c,
		users.History(users.HistoryVM{}),
		200,
	)
}

func (uws *UsersWebService) Account(c echo.Context) error {
	return web.Render(
		c,
		users.Account(users.AccountVM{}),
		200,
	)
}

func (uws *UsersWebService) ChoosePlan(c echo.Context) error {
	return web.Render(c, users.ChoosePlan(users.ChoosePlanVM{}), 200)
}
