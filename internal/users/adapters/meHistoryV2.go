package adapters

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/labstack/echo/v4"
)

type meHistoryEvent struct {
	ID              string `json:"id" db:"id"`
	ScannedAt       string `json:"scannedAt" db:"scanned_at"`
	Result          string `json:"result" db:"result"` // allowed/denied
	Reason          string `json:"reason" db:"reason"`
	LocationID      string `json:"locationId" db:"location_id"`
	LocationName    string `json:"locationName" db:"location_name"`
	LocationAddress string `json:"locationAddress" db:"location_address"`
}

func (m *MeAPIService) GetMyHistoryV2(c echo.Context) error {
	if m.db == nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "db not configured"})
	}

	uid, ok := m.authedUserID(c)
	if !ok {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
	}

	limit := 50
	if s := strings.TrimSpace(c.QueryParam("limit")); s != "" {
		if n, err := strconv.Atoi(s); err == nil {
			if n < 1 {
				n = 1
			}
			if n > 200 {
				n = 200
			}
			limit = n
		}
	}

	// Optional filters
	locationID := strings.TrimSpace(c.QueryParam("locationId")) // "all" or empty -> no filter
	result := strings.TrimSpace(c.QueryParam("result"))         // allowed/denied

	base := `
		SELECT
			e.id,
			COALESCE(e.scanned_at::text,'') AS scanned_at,
			COALESCE(e.result,'') AS result,
			COALESCE(e.reason,'') AS reason,
			COALESCE(e.location_id,'') AS location_id,
			COALESCE(l.name,'') AS location_name,
			COALESCE(l.address,'') AS location_address
		FROM wash_events e
		LEFT JOIN locations l ON l.id = e.location_id
		WHERE e.user_id = ?
	`
	args := []any{uid}

	if locationID != "" && locationID != "all" {
		base += " AND e.location_id = ?"
		args = append(args, locationID)
	}
	if result != "" {
		base += " AND e.result = ?"
		args = append(args, result)
	}

	base += " ORDER BY e.scanned_at DESC LIMIT ?"
	args = append(args, limit)

	q := m.db.Rebind(base)

	var events []meHistoryEvent
	if err := m.db.Select(&events, q, args...); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]any{"events": events})
}
