package adapters

import (
	"net/http"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
)

type PublicLocation struct {
	ID      string `json:"id" db:"id"`
	Name    string `json:"name" db:"name"`
	Address string `json:"address" db:"address"`
}

type LocationsAPIService struct {
	httpService *echo.Group
	db          *sqlx.DB
}

func NewLocationsAPIService(httpService *echo.Group) *LocationsAPIService {
	return &LocationsAPIService{httpService: httpService}
}

func (s *LocationsAPIService) WithDB(db *sqlx.DB) *LocationsAPIService {
	s.db = db
	return s
}

func (s *LocationsAPIService) RegisterRoutes() {
	s.httpService.GET("/locations", s.List)
}

func (s *LocationsAPIService) List(c echo.Context) error {
	if s.db == nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "db not configured"})
	}
	q := s.db.Rebind(`SELECT id, name, COALESCE(address,'') AS address FROM locations ORDER BY name ASC`)
	var locs []PublicLocation
	if err := s.db.Select(&locs, q); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]any{"locations": locs})
}
