package adapters

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
)

type ScanAPIService struct {
	httpService *echo.Group
	db          *sqlx.DB
}

type ScanRequest struct {
	QR         string `json:"qr"`
	LocationID string `json:"locationId"`
}

type ScanResponse struct {
	Allowed    bool   `json:"allowed"`
	Reason     string `json:"reason,omitempty"`
	UserID     int    `json:"userId,omitempty"`
	PlanID     string `json:"planId,omitempty"`
	PlanName   string `json:"planName,omitempty"`
	LocationID string `json:"locationId,omitempty"`
	UserName   string `json:"userName,omitempty"`
}

type subscriptionRow struct {
	ID     string `db:"id"`
	UserID int    `db:"user_id"`
	PlanID string `db:"plan_id"`
	Status string `db:"status"`
}

type planRow struct {
	ID   string `db:"id"`
	Name string `db:"name"`
}

func NewScanAPIService(httpService *echo.Group) *ScanAPIService {
	return &ScanAPIService{
		httpService: httpService,
		db:          nil,
	}
}

func (s *ScanAPIService) WithDB(db *sqlx.DB) *ScanAPIService {
	s.db = db
	return s
}

func (s *ScanAPIService) RegisterRoutes() {
	s.httpService.POST("/scan", s.Scan)
}

func (s *ScanAPIService) Scan(c echo.Context) error {
	if s.db == nil {
		return c.JSON(http.StatusInternalServerError, ScanResponse{Allowed: false, Reason: "Server misconfigured (db)"})
	}

	var req ScanRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, ScanResponse{Allowed: false, Reason: "Invalid JSON"})
	}
	req.QR = strings.TrimSpace(req.QR)
	req.LocationID = strings.TrimSpace(req.LocationID)

	userID, parseReason := parseUserIDFromQR(req.QR)
	if userID == 0 {
		// log denied event
		if err := insertWashEvent(s.db, 0, req.LocationID, "denied", req.QR, parseReason); err != nil {
			// Do not allow success if we failed to record the event
			return c.JSON(500, map[string]any{"allowed": false, "reason": "Failed to record wash event"})
		}

		return c.JSON(http.StatusBadRequest, ScanResponse{Allowed: false, Reason: parseReason, LocationID: req.LocationID})
	}

	// Validate active subscription
	var sub subscriptionRow
	err := s.db.Get(&sub, s.db.Rebind(`
		SELECT id, user_id, plan_id, status
		FROM subscriptions
		WHERE user_id = ? AND status = 'active'
		LIMIT 1
	`), userID)

	if err != nil {
		reason := "No active subscription"
		_ = insertWashEvent(s.db, userID, req.LocationID, "denied", req.QR, reason)
		return c.JSON(http.StatusOK, ScanResponse{Allowed: false, Reason: reason, UserID: userID, LocationID: req.LocationID,
			UserName: scanUserDisplayName(s.db, userID)})
	}

	// Lookup plan
	var plan planRow
	_ = s.db.Get(&plan, s.db.Rebind(`SELECT id, name FROM plans WHERE id = ? LIMIT 1`), sub.PlanID)

	_ = insertWashEvent(s.db, userID, req.LocationID, "allowed", req.QR, "")

	return c.JSON(http.StatusOK, ScanResponse{
		Allowed:    true,
		UserID:     userID,
		PlanID:     sub.PlanID,
		PlanName:   plan.Name,
		LocationID: req.LocationID,
		UserName:   scanUserDisplayName(s.db, userID),
	})
}

func parseUserIDFromQR(qr string) (int, string) {
	if qr == "" {
		return 0, "Missing qr"
	}
	parts := strings.Split(qr, "-")
	if len(parts) < 2 || parts[0] != "CARWASH" {
		return 0, "Invalid QR code format"
	}
	// user_id in your system is numeric (sqlite users.id INTEGER)
	uidStr := parts[1]
	uid := 0
	for _, ch := range uidStr {
		if ch < '0' || ch > '9' {
			return 0, "Invalid user id in QR"
		}
		uid = uid*10 + int(ch-'0')
	}
	if uid <= 0 {
		return 0, "Invalid user id in QR"
	}
	return uid, ""
}

type scanUserRow struct {
	FirstName string `db:"first_name"`
	LastName  string `db:"last_name"`
	Username  string `db:"username"`
}

func scanUserDisplayName(db *sqlx.DB, userID int) string {
	if db == nil {
		return fmt.Sprintf("Member #%d", userID)
	}
	var u scanUserRow
	q := db.Rebind(`SELECT COALESCE(first_name,'') AS first_name, COALESCE(last_name,'') AS last_name, COALESCE(username,'') AS username FROM users WHERE id = ? LIMIT 1`)
	_ = db.Get(&u, q, userID)

	name := strings.TrimSpace(strings.TrimSpace(u.FirstName) + " " + strings.TrimSpace(u.LastName))
	if name != "" {
		return name
	}
	if strings.TrimSpace(u.Username) != "" {
		return strings.TrimSpace(u.Username)
	}
	return fmt.Sprintf("Member #%d", userID)
}

func insertWashEvent(db *sqlx.DB, userID int, locationID, result, rawQR, reason string) error {
	id := uuid.NewString()
	scannedAt := time.Now().UTC().Format(time.RFC3339)

	q := db.Rebind(`
		INSERT INTO wash_events (id, user_id, location_id, scanned_at, result, raw_qr, reason)
		VALUES (?, ?, NULLIF(?, ''), ?, ?, ?, NULLIF(?, ''))
	`)
	_, err := db.Exec(q, id, userID, locationID, scannedAt, result, rawQR, reason)
	return err
}
