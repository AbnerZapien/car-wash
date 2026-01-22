package adapters

import (
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
)

type setSubscriptionReq struct {
	PlanID string `json:"planId"`
}

func (m *MeAPIService) SetMySubscription(c echo.Context) error {
	if m.db == nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "db not configured"})
	}

	uid, ok := m.authedUserID(c)
	if !ok {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
	}

	var req setSubscriptionReq
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid json"})
	}
	req.PlanID = strings.TrimSpace(req.PlanID)
	if req.PlanID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "planId is required"})
	}

	// Validate plan exists + get name/price/features for response
	type planFull struct {
		ID           string `db:"id"`
		Name         string `db:"name"`
		PriceCents   int    `db:"price_cents"`
		FeaturesJSON string `db:"features_json"`
	}
	var p planFull
	qPlan := m.db.Rebind(`SELECT id, name, price_cents, features_json FROM plans WHERE id = ? LIMIT 1`)
	if err := m.db.Get(&p, qPlan, req.PlanID); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "unknown planId"})
	}

	next := time.Now().AddDate(0, 1, 0).Format("2006-01-02") // 1 month from now (simple)

	tx, err := m.db.Beginx()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "db error"})
	}
	defer tx.Rollback()

	// Cancel any existing active subs
	if _, err := tx.Exec(tx.Rebind(`UPDATE subscriptions SET status = 'canceled' WHERE user_id = ? AND status = 'active'`), uid); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	// Create new active sub
	subID := uuid.NewString()
	if _, err := tx.Exec(tx.Rebind(`
		INSERT INTO subscriptions (id, user_id, plan_id, status, next_billing_date)
		VALUES (?, ?, ?, 'active', ?)
	`), subID, uid, req.PlanID, next); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	if err := tx.Commit(); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	// Return the same shape as GET /me/subscription uses
	out := subscriptionOut{
		PlanID:          p.ID,
		PlanName:        p.Name,
		PriceCents:      p.PriceCents,
		FeaturesJSON:    p.FeaturesJSON,
		Status:          "active",
		NextBillingDate: next,
	}

	return c.JSON(http.StatusOK, map[string]any{"active": true, "subscription": out})
}
