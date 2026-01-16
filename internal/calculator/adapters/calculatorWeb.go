package adapters

import (
	"github.com/edlingao/hexago/common/delivery/web"
	"github.com/edlingao/hexago/internal/calculator/core"
	"github.com/edlingao/hexago/internal/calculator/ports"
	"github.com/edlingao/hexago/web/views"
	"github.com/labstack/echo/v4"
)

type CalculatorWebpage struct {
	URL         string
	http        *echo.Group
	calcService ports.CalculatorOperations
	dbService   ports.StoringOperations[core.Calculation]
}

func NewCalculatorWebpage(
	url string,
	httpService *echo.Group,
	calcService ports.CalculatorOperations,
	dbService ports.StoringOperations[core.Calculation],
) *CalculatorWebpage {

	calculatorWebPageService := &CalculatorWebpage{
		URL:         url,
		http:        httpService,
		calcService: calcService,
		dbService:   dbService,
	}

	calculatorWebPageService.http.GET("/", calculatorWebPageService.Home)
	calculatorWebPageService.http.POST("/calculate", calculatorWebPageService.Calculate)
	calculatorWebPageService.http.GET("/history", calculatorWebPageService.History)
	calculatorWebPageService.http.GET("/mobile-preview", calculatorWebPageService.MobilePreview)
	calculatorWebPageService.http.GET("/about", calculatorWebPageService.About)
	calculatorWebPageService.http.GET("/terms", calculatorWebPageService.Terms)
	calculatorWebPageService.http.GET("/privacy", calculatorWebPageService.Privacy)
	calculatorWebPageService.http.GET("/cookies", calculatorWebPageService.Cookies)
	calculatorWebPageService.http.GET("/contact", calculatorWebPageService.Contact)
	calculatorWebPageService.http.POST("/contact", calculatorWebPageService.ContactSubmit)

	return calculatorWebPageService
}

func (cw *CalculatorWebpage) Home(c echo.Context) error {
	return web.Render(
		c,
		views.Index(views.IndexVM{}),
		200,
	)
}

func (cw *CalculatorWebpage) Calculate(c echo.Context) error {
	return web.Render(
		c,
		views.Index(views.IndexVM{}),
		200,
	)
}

func (cw *CalculatorWebpage) History(c echo.Context) error {
	return web.Render(
		c,
		views.Index(views.IndexVM{}),
		200,
	)
}

func (cw *CalculatorWebpage) About(c echo.Context) error {
	return web.Render(
		c,
		views.About(views.AboutVM{}),
		200,
	)
}

func (cw *CalculatorWebpage) Terms(c echo.Context) error {
	return web.Render(
		c,
		views.Terms(views.TermsVM{}),
		200,
	)
}

func (cw *CalculatorWebpage) Privacy(c echo.Context) error {
	return web.Render(
		c,
		views.Privacy(views.PrivacyVM{}),
		200,
	)
}

func (cw *CalculatorWebpage) Cookies(c echo.Context) error {
	return web.Render(
		c,
		views.Cookies(views.CookiesVM{}),
		200,
	)
}

func (cw *CalculatorWebpage) Contact(c echo.Context) error {
	return web.Render(
		c,
		views.Contact(views.ContactVM{}),
		200,
	)
}

func (cw *CalculatorWebpage) ContactSubmit(c echo.Context) error {
	name := c.FormValue("name")
	return web.Render(
		c,
		views.Contact(views.ContactVM{Submitted: true, Name: name}),
		200,
	)
}

func (cw *CalculatorWebpage) MobilePreview(c echo.Context) error {
	return web.Render(
		c,
		views.MobilePreview(views.MobilePreviewVM{}),
		200,
	)
}
