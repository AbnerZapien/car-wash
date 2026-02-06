package adapters

import (
	"encoding/csv"
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
)

type adminMembershipExportRow struct {
	UserID             int    `db:"user_id"`
	Username           string `db:"username"`
	Email              string `db:"email"`
	FirstName          string `db:"first_name"`
	LastName           string `db:"last_name"`
	SubscriptionStatus string `db:"subscription_status"`
	PlanID             string `db:"plan_id"`
	PlanName           string `db:"plan_name"`
	PriceCents         int    `db:"price_cents"`
	StartDate          string `db:"start_date"`
	NextBillingDate    string `db:"next_billing_date"`
	WashCount          int    `db:"wash_count"`
}

func (a *AdminAPIService) ExportMembershipsCSV(c echo.Context) error {
	if a.db == nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "db not configured"})
	}

	rows := []adminMembershipExportRow{}
	q := a.db.Rebind(`
		SELECT
			u.id AS user_id,
			COALESCE(u.username,'') AS username,
			COALESCE(u.email,'') AS email,
			COALESCE(u.first_name,'') AS first_name,
			COALESCE(u.last_name,'') AS last_name,
			COALESCE(s.status,'') AS subscription_status,
			COALESCE(s.plan_id,'') AS plan_id,
			COALESCE(p.name,'') AS plan_name,
			COALESCE(p.price_cents,0) AS price_cents,
			COALESCE(s.start_date,'') AS start_date,
			COALESCE(s.next_billing_date,'') AS next_billing_date,
			COALESCE(s.wash_count,0) AS wash_count
		FROM users u
		LEFT JOIN subscriptions s ON s.user_id = u.id
		LEFT JOIN plans p ON p.id = s.plan_id
		ORDER BY u.id
	`)
	if err := a.db.Select(&rows, q); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "export failed"})
	}

	c.Response().Header().Set(echo.HeaderContentType, "text/csv; charset=utf-8")
	c.Response().Header().Set("Content-Disposition", `attachment; filename="hedgestone_memberships.csv"`)
	c.Response().Header().Set("Cache-Control", "no-store")
	c.Response().WriteHeader(http.StatusOK)

	_, _ = c.Response().Writer.Write([]byte("\ufeff"))

	w := csv.NewWriter(c.Response().Writer)
	_ = w.Write([]string{
		"user_id", "username", "email", "first_name", "last_name",
		"subscription_status", "plan_id", "plan_name", "price_cents",
		"start_date", "next_billing_date", "wash_count",
	})

	for _, r := range rows {
		_ = w.Write([]string{
			strconv.Itoa(r.UserID),
			r.Username,
			r.Email,
			r.FirstName,
			r.LastName,
			r.SubscriptionStatus,
			r.PlanID,
			r.PlanName,
			strconv.Itoa(r.PriceCents),
			r.StartDate,
			r.NextBillingDate,
			strconv.Itoa(r.WashCount),
		})
	}

	w.Flush()
	if err := w.Error(); err != nil {
		return err
	}
	return nil
}

type adminWashEventExportRow struct {
	ID              string `db:"id"`
	UserID          string `db:"user_id"`
	LocationID      string `db:"location_id"`
	LocationName    string `db:"location_name"`
	LocationAddress string `db:"location_address"`
	ScannedAt       string `db:"scanned_at"`
	Result          string `db:"result"`
	Reason          string `db:"reason"`
	RawQR           string `db:"raw_qr"`
}

func (a *AdminAPIService) ExportWashEventsCSV(c echo.Context) error {
	if a.db == nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "db not configured"})
	}

	rows := []adminWashEventExportRow{}
	q := a.db.Rebind(`
		SELECT
			COALESCE(CAST(e.id AS TEXT), '') AS id,
			COALESCE(CAST(e.user_id AS TEXT), '') AS user_id,
			COALESCE(CAST(e.location_id AS TEXT), '') AS location_id,
			COALESCE(CAST(l.name AS TEXT), '') AS location_name,
			COALESCE(CAST(l.address AS TEXT), '') AS location_address,
			COALESCE(CAST(e.scanned_at AS TEXT), '') AS scanned_at,
			COALESCE(CAST(e.result AS TEXT), '') AS result,
			COALESCE(CAST(e.reason AS TEXT), '') AS reason,
			COALESCE(CAST(e.raw_qr AS TEXT), '') AS raw_qr
		FROM wash_events e
		LEFT JOIN locations l ON CAST(l.id AS TEXT) = CAST(e.location_id AS TEXT)
		ORDER BY e.scanned_at DESC
	`)
	if err := a.db.Select(&rows, q); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "export failed"})
	}

	c.Response().Header().Set(echo.HeaderContentType, "text/csv; charset=utf-8")
	c.Response().Header().Set("Content-Disposition", `attachment; filename="hedgestone_wash_events.csv"`)
	c.Response().Header().Set("Cache-Control", "no-store")
	c.Response().WriteHeader(http.StatusOK)

	_, _ = c.Response().Writer.Write([]byte("\ufeff"))

	w := csv.NewWriter(c.Response().Writer)
	_ = w.Write([]string{
		"id", "user_id", "location_id", "location_name", "location_address",
		"scanned_at", "result", "reason", "raw_qr",
	})

	for _, r := range rows {
		_ = w.Write([]string{
			r.ID,
			r.UserID,
			r.LocationID,
			r.LocationName,
			r.LocationAddress,
			r.ScannedAt,
			r.Result,
			r.Reason,
			r.RawQR,
		})
	}

	w.Flush()
	if err := w.Error(); err != nil {
		return err
	}
	return nil
}
