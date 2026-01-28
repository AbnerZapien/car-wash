package adapters

import (
	"net/http"
	"sort"
	"strings"

	"github.com/labstack/echo/v4"
)

type CarCatalogAPIService struct {
	httpService *echo.Group
}

func NewCarCatalogAPIService(httpService *echo.Group) *CarCatalogAPIService {
	return &CarCatalogAPIService{httpService: httpService}
}

func (s *CarCatalogAPIService) RegisterRoutes() {
	// Public endpoints for typeahead suggestions
	s.httpService.GET("/cars/makes", s.ListMakes)
	s.httpService.GET("/cars/models", s.ListModels)
}

var carMakes = []string{
	"Acura", "Audi", "BMW", "Chevrolet", "Dodge", "Ford", "GMC", "Honda", "Hyundai",
	"Jeep", "Kia", "Lexus", "Mazda", "Mercedes-Benz", "Nissan", "Subaru", "Tesla",
	"Toyota", "Volkswagen", "Volvo",
}

// Small starter model map (expand later or replace with a real provider)
var carModelsByMake = map[string][]string{
	"Toyota": {"Camry", "Corolla", "RAV4", "Highlander", "Tacoma", "Tundra", "Prius"},
	"Tesla":  {"Model S", "Model 3", "Model X", "Model Y", "Cybertruck"},
	"Honda":  {"Civic", "Accord", "CR-V", "Pilot", "Fit"},
	"Ford":   {"F-150", "Mustang", "Explorer", "Escape", "Bronco"},
	"Nissan": {"Altima", "Sentra", "Rogue", "Frontier", "Pathfinder"},
}

func filterPrefix(list []string, q string, limit int) []string {
	q = strings.TrimSpace(strings.ToLower(q))
	out := make([]string, 0, limit)

	for _, item := range list {
		if q == "" || strings.HasPrefix(strings.ToLower(item), q) {
			out = append(out, item)
			if len(out) >= limit {
				return out
			}
		}
	}
	return out
}

func (s *CarCatalogAPIService) ListMakes(c echo.Context) error {
	q := c.QueryParam("q")
	// year param is accepted but currently unused (keeps UI stable)
	_ = c.QueryParam("year")

	makes := append([]string{}, carMakes...)
	sort.Strings(makes)

	return c.JSON(http.StatusOK, map[string]any{
		"makes": filterPrefix(makes, q, 25),
	})
}

func (s *CarCatalogAPIService) ListModels(c echo.Context) error {
	q := c.QueryParam("q")
	makeName := strings.TrimSpace(c.QueryParam("make"))
	// year param is accepted but currently unused (keeps UI stable)
	_ = c.QueryParam("year")

	if makeName == "" {
		return c.JSON(http.StatusOK, map[string]any{"models": []string{}})
	}

	// Try exact match first, then case-insensitive match
	models := carModelsByMake[makeName]
	if models == nil {
		for k, v := range carModelsByMake {
			if strings.EqualFold(k, makeName) {
				models = v
				break
			}
		}
	}
	if models == nil {
		models = []string{}
	}

	return c.JSON(http.StatusOK, map[string]any{
		"models": filterPrefix(models, q, 25),
	})
}
