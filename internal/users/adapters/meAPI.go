package adapters

import (
	"net/http"
	"os"
	"strings"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
)

type MeAPIService struct {
	httpService *echo.Group
	db          *sqlx.DB
}

func NewMeAPIService(httpService *echo.Group) *MeAPIService {
	return &MeAPIService{httpService: httpService}
}

func (m *MeAPIService) WithDB(db *sqlx.DB) *MeAPIService {
	m.db = db
	return m
}

func (m *MeAPIService) RegisterRoutes() {
	m.httpService.GET("/me", m.GetMe)
	m.httpService.PUT("/me", m.UpdateMe)
	m.httpService.GET("/me/subscription", m.GetMySubscription)
	m.httpService.GET("/me/history", m.GetMyHistory)
}

type meRow struct {
	ID        int    `db:"id" json:"id"`
	Username  string `db:"username" json:"username"`
	Email     string `db:"email" json:"email"`
	FirstName string `db:"first_name" json:"firstName"`
	LastName  string `db:"last_name" json:"lastName"`
	AvatarURL string `db:"avatar_url" json:"avatarUrl"`
}

type updateMeRequest struct {
	Email     string `json:"email"`
	FirstName string `json:"firstName"`
	LastName  string `json:"lastName"`
	AvatarURL string `json:"avatarUrl"`
}

type subscriptionOut struct {
	PlanID          string `json:"planId" db:"plan_id"`
	PlanName        string `json:"planName" db:"plan_name"`
	PriceCents      int    `json:"priceCents" db:"price_cents"`
	FeaturesJSON    string `json:"featuresJson" db:"features_json"`
	Status          string `json:"status" db:"status"`
	NextBillingDate string `json:"nextBillingDate" db:"next_billing_date"`
}

func (m *MeAPIService) GetMe(c echo.Context) error {
	if m.db == nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "db not configured"})
	}

	uid, ok := m.authedUserID(c)
	if !ok {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
	}

	var u meRow
	if err := m.db.Get(&u, `SELECT id, username, email, first_name, last_name, avatar_url FROM users WHERE id = ? LIMIT 1`, uid); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, u)
}

func (m *MeAPIService) UpdateMe(c echo.Context) error {
	if m.db == nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "db not configured"})
	}

	uid, ok := m.authedUserID(c)
	if !ok {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
	}

	var req updateMeRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid json"})
	}

	req.Email = strings.TrimSpace(req.Email)
	req.FirstName = strings.TrimSpace(req.FirstName)
	req.LastName = strings.TrimSpace(req.LastName)
	req.AvatarURL = strings.TrimSpace(req.AvatarURL)

	// Minimal validation for now
	if req.Email != "" && !strings.Contains(req.Email, "@") {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid email"})
	}

	_, err := m.db.Exec(`
		UPDATE users
		SET email = COALESCE(?, email),
		    first_name = COALESCE(?, first_name),
		    last_name = COALESCE(?, last_name),
		    avatar_url = COALESCE(?, avatar_url)
		WHERE id = ?
	`, nullIfEmpty(req.Email), nullIfEmpty(req.FirstName), nullIfEmpty(req.LastName), nullIfEmpty(req.AvatarURL), uid)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "update failed"})
	}

	var u meRow
	_ = m.db.Get(&u, `SELECT id, username, email, first_name, last_name, avatar_url FROM users WHERE id = ? LIMIT 1`, uid)
	return c.JSON(http.StatusOK, u)
}

func (m *MeAPIService) GetMySubscription(c echo.Context) error {
	if m.db == nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "db not configured"})
	}

	uid, ok := m.authedUserID(c)
	if !ok {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
	}

	var out subscriptionOut
	err := m.db.Get(&out, `
		SELECT s.plan_id,
		       p.name as plan_name,
		       p.price_cents,
		       p.features_json,
		       s.status,
		       s.next_billing_date
		FROM subscriptions s
		JOIN plans p ON p.id = s.plan_id
		WHERE s.user_id = ? AND s.status = 'active'
		LIMIT 1
	`, uid)

	if err != nil {
		return c.JSON(http.StatusOK, map[string]any{"active": false, "subscription": nil})
	}

	return c.JSON(http.StatusOK, map[string]any{"active": true, "subscription": out})
}

// --- auth helpers ---
// Accept token from Authorization: Bearer <token>, or X-Session-Token, or cookie "token"/"session_token".
func (m *MeAPIService) authedUserID(c echo.Context) (int, bool) {
	env := os.Getenv("ENV")

	// DEV-only escape hatch (optional): X-Demo-UserId
	if env != "production" {
		if demo := c.Request().Header.Get("X-Demo-UserId"); demo != "" {
			uid := 0
			for _, ch := range demo {
				if ch < '0' || ch > '9' {
					uid = 0
					break
				}
				uid = uid*10 + int(ch-'0')
			}
			if uid > 0 {
				return uid, true
			}
		}
	}

	token := ""
	auth := c.Request().Header.Get("Authorization")
	if strings.HasPrefix(auth, "Bearer ") {
		token = strings.TrimSpace(strings.TrimPrefix(auth, "Bearer "))
	}
	if token == "" {
		token = strings.TrimSpace(c.Request().Header.Get("X-Session-Token"))
	}
	if token == "" {
		if ck, err := c.Cookie("session_token"); err == nil {
			token = ck.Value
		}
	}
	if token == "" {
		if ck, err := c.Cookie("token"); err == nil {
			token = ck.Value
		}
	}
	if token == "" {
		return 0, false
	}

	type sessRow struct {
		UserID int `db:"user_id"`
	}
	var s sessRow
	if err := m.db.Get(&s, `SELECT user_id FROM sessions WHERE token = ? LIMIT 1`, token); err != nil {
		return 0, false
	}
	return s.UserID, true
}

func nullIfEmpty(s string) any {
	if s == "" {
		return nil
	}
	return s
}

type historyItem struct {
	ID              string `json:"id" db:"id"`
	UserID          int    `json:"userId" db:"user_id"`
	LocationID      string `json:"locationId" db:"location_id"`
	LocationName    string `json:"locationName" db:"location_name"`
	LocationAddress string `json:"locationAddress" db:"location_address"`
	ScannedAt       string `json:"scannedAt" db:"scanned_at"`
	Result          string `json:"result" db:"result"`
	Reason          string `json:"reason" db:"reason"`
	RawQR           string `json:"rawQr" db:"raw_qr"`
}

func (m *MeAPIService) GetMyHistory(c echo.Context) error {
	if m.db == nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "db not configured"})
	}

	uid, ok := m.authedUserID(c)
	if !ok {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
	}

	items := []historyItem{}
	// Return the most recent 100 events for now
	err := m.db.Select(&items, `
		SELECT e.id,
		       e.user_id,
		       IFNULL(e.location_id,'') as location_id,
		       IFNULL(l.name,'') as location_name,
		       IFNULL(l.address,'') as location_address,
		       e.scanned_at,
		       e.result,
		       IFNULL(e.reason,'') as reason,
		       e.raw_qr
		FROM wash_events e
		LEFT JOIN locations l ON l.id = e.location_id
		WHERE e.user_id = ?
		ORDER BY e.scanned_at DESC
		LIMIT 100
	`, uid)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]any{"items": items})
}
