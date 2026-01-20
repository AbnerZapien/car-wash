package configurator

import (
	"os"

	auth "github.com/edlingao/go-auth/auth/core"
	usersAdapter "github.com/edlingao/hexago/internal/users/adapters"
	usersCore "github.com/edlingao/hexago/internal/users/core"
	usersPorts "github.com/edlingao/hexago/internal/users/ports"

	_ "github.com/joho/godotenv/autoload"
	"github.com/labstack/echo/v4"
)

type Configurator struct {
	UserAPIHandler usersAdapter.UsersAPIService
	UserWebPage    usersAdapter.UsersWebService
	Echo           *echo.Echo
	v1             *echo.Group
	root           *echo.Group
}

func New(
	echo *echo.Echo,
) *Configurator {
	// V1
	api := echo.Group("/api")
	v1 := api.Group("/v1")

	root := echo.Group("")

	return &Configurator{
		Echo: echo,
		v1:   v1,
		root: root,
	}
}

func (c *Configurator) AddCalculatorAPI() *Configurator {

	return c
}

func (c *Configurator) AddCalculatorWeb() *Configurator {

	return c
}

func (c *Configurator) AddUserAPI() *Configurator {
	dbService := usersAdapter.NewDB[usersCore.User]()
	sessionDBService := usersAdapter.NewSessionStore[auth.Session]()

	userService := usersPorts.NewUserService(dbService)
	usersHttpService := c.v1.Group("/users")
	sessionService := auth.NewSessionService(
		sessionDBService,
		"Auth", // Cookie name or header name
	)

	userAPIHandler := usersAdapter.NewUsersAPIService(
		dbService,
		usersHttpService,
		sessionService,
		userService,
	)

	c.UserAPIHandler = *userAPIHandler

	return c
}

func (c *Configurator) AddUserWeb() *Configurator {
	dbService := usersAdapter.NewDB[usersCore.User]()
	sessionDBService := usersAdapter.NewSessionStore[auth.Session]()

	userService := usersPorts.NewUserService(dbService)
	usersHttpService := c.root
	sessionService := auth.NewSessionService(
		sessionDBService,
		"Auth", // Cookie name or header name
	)

	usersWebPage := usersAdapter.NewUsersWebService(
		"/",
		usersHttpService,
		sessionService,
		dbService,
		userService,
	)
	c.UserWebPage = *usersWebPage

	return c
}

func (c *Configurator) Start() {
	port := os.Getenv("GO_PORT")
	c.Echo.Logger.Fatal(c.Echo.Start(":" + port))
}

func (c *Configurator) AddScanAPI() *Configurator {
	db, err := usersAdapter.ConnectSQLite()
	if err != nil {
		panic(err)
	}

	scanAPI := usersAdapter.NewScanAPIService(c.v1).WithDB(db)
	scanAPI.RegisterRoutes()
	return c
}

func (c *Configurator) AddMeAPI() *Configurator {
	db, err := usersAdapter.ConnectSQLite()
	if err != nil {
		panic(err)
	}
	meAPI := usersAdapter.NewMeAPIService(c.v1).WithDB(db)
	meAPI.RegisterRoutes()
	return c
}
