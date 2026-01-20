package adapters

import (
	"net/http"

	"github.com/labstack/echo/v4"
)

type PlansAPIService struct {
	httpService *echo.Group
}

func NewPlansAPIService(httpService *echo.Group) *PlansAPIService {
	s := &PlansAPIService{httpService: httpService}
	s.httpService.GET("/plans", s.ListPlans)
	return s
}

type PlanRow struct {
	ID           string `db:"id" json:"id"`
	Name         string `db:"name" json:"name"`
	PriceCents   int    `db:"price_cents" json:"priceCents"`
	FeaturesJSON string `db:"features_json" json:"featuresJson"`
}

func (s *PlansAPIService) ListPlans(c echo.Context) error {
	db, err := ConnectDB()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "db error"})
	}
	defer db.Close()

	var plans []PlanRow
	q := db.Rebind(`SELECT id, name, price_cents, features_json FROM plans ORDER BY price_cents ASC`)
	if err := db.Select(&plans, q); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]any{"plans": plans})
}
