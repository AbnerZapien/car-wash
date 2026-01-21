package adapters

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
)

type AdminAPIService struct {
	httpService *echo.Group
	db          *sqlx.DB
}

func NewAdminAPIService(httpService *echo.Group) *AdminAPIService {
	return &AdminAPIService{httpService: httpService}
}

func (a *AdminAPIService) WithDB(db *sqlx.DB) *AdminAPIService {
	a.db = db
	return a
}

func (a *AdminAPIService) RegisterRoutes() {
	g := a.httpService.Group("/admin", a.requireAdmin)
	g.GET("/members", a.ListMembers)
	g.DELETE("/users/:id", a.DeleteUser)
	g.GET("/plans", a.ListPlans)
	g.POST("/plans", a.CreatePlan)
	g.PUT("/plans/:id", a.UpdatePlan)
	g.DELETE("/plans/:id", a.DeletePlan)
}

// Demo rule: admin user is username == "admin"
func (a *AdminAPIService) requireAdmin(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		if a.db == nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "db not configured"})
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
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		}

		var uid int64
		q := a.db.Rebind(`SELECT user_id FROM sessions WHERE token = ? LIMIT 1`)
		if err := a.db.Get(&uid, q, token); err != nil {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		}

		var uname string
		q2 := a.db.Rebind(`SELECT username FROM users WHERE id = ? LIMIT 1`)
		if err := a.db.Get(&uname, q2, uid); err != nil {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		}
		if uname != "admin" {
			return c.JSON(http.StatusForbidden, map[string]string{"error": "forbidden"})
		}

		return next(c)
	}
}

type AdminMember struct {
	ID          int64  `json:"id" db:"id"`
	Username    string `json:"username" db:"username"`
	Email       string `json:"email" db:"email"`
	FirstName   string `json:"firstName" db:"first_name"`
	LastName    string `json:"lastName" db:"last_name"`
	AvatarURL   string `json:"avatarUrl" db:"avatar_url"`
	CreatedAt   string `json:"createdAt" db:"created_at"`
	PlanID      string `json:"planId" db:"plan_id"`
	PlanName    string `json:"planName" db:"plan_name"`
	SubStatus   string `json:"subStatus" db:"sub_status"`
	NextBilling string `json:"nextBillingDate" db:"next_billing_date"`
	Washes      int    `json:"washCount" db:"wash_count"`
}

func (a *AdminAPIService) ListMembers(c echo.Context) error {
	q := a.db.Rebind(`
		SELECT
			u.id, u.username, u.email, u.first_name, u.last_name, u.avatar_url,
			COALESCE(u.created_at::text,'') as created_at,
			COALESCE(s.plan_id,'') as plan_id,
			COALESCE(p.name,'') as plan_name,
			COALESCE(s.status,'none') as sub_status,
			COALESCE(s.next_billing_date,'') as next_billing_date,
			COALESCE(w.cnt,0) as wash_count
		FROM users u
		LEFT JOIN subscriptions s ON s.user_id = u.id AND s.status = 'active'
		LEFT JOIN plans p ON p.id = s.plan_id
		LEFT JOIN (
			SELECT user_id, COUNT(*) cnt
			FROM wash_events
			GROUP BY user_id
		) w ON w.user_id = u.id
		ORDER BY u.id DESC
	`)

	var members []AdminMember
	if err := a.db.Select(&members, q); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]any{"members": members})
}

func (a *AdminAPIService) DeleteUser(c echo.Context) error {
	idStr := c.Param("id")
	uid, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil || uid <= 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid user id"})
	}
	// prevent deleting admin seed (id=2 is common)
	var uname string
	qU := a.db.Rebind(`SELECT username FROM users WHERE id = ? LIMIT 1`)
	_ = a.db.Get(&uname, qU, uid)
	if uname == "admin" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "cannot delete admin user"})
	}

	tx, err := a.db.Beginx()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "db error"})
	}
	defer tx.Rollback()

	if _, err := tx.Exec(tx.Rebind(`DELETE FROM wash_events WHERE user_id = ?`), uid); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	if _, err := tx.Exec(tx.Rebind(`DELETE FROM sessions WHERE user_id = ?`), uid); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	if _, err := tx.Exec(tx.Rebind(`DELETE FROM subscriptions WHERE user_id = ?`), uid); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	if _, err := tx.Exec(tx.Rebind(`DELETE FROM users WHERE id = ?`), uid); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	if err := tx.Commit(); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]any{"ok": true})
}

type AdminPlan struct {
	ID           string `json:"id" db:"id"`
	Name         string `json:"name" db:"name"`
	PriceCents   int    `json:"priceCents" db:"price_cents"`
	FeaturesJSON string `json:"featuresJson" db:"features_json"`
}

func (a *AdminAPIService) ListPlans(c echo.Context) error {
	q := a.db.Rebind(`SELECT id, name, price_cents, features_json FROM plans ORDER BY price_cents ASC`)
	var plans []AdminPlan
	if err := a.db.Select(&plans, q); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]any{"plans": plans})
}

type planReq struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	PriceCents   int    `json:"priceCents"`
	FeaturesJSON string `json:"featuresJson"`
}

func (a *AdminAPIService) CreatePlan(c echo.Context) error {
	var req planReq
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid json"})
	}
	req.ID = strings.TrimSpace(req.ID)
	req.Name = strings.TrimSpace(req.Name)
	if req.ID == "" || req.Name == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "id and name are required"})
	}
	if req.PriceCents < 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "priceCents must be >= 0"})
	}
	if req.FeaturesJSON == "" {
		req.FeaturesJSON = "[]"
	}

	q := a.db.Rebind(`INSERT INTO plans (id, name, price_cents, features_json) VALUES (?, ?, ?, ?)`)
	if _, err := a.db.Exec(q, req.ID, req.Name, req.PriceCents, req.FeaturesJSON); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]any{"ok": true})
}

func (a *AdminAPIService) UpdatePlan(c echo.Context) error {
	planID := strings.TrimSpace(c.Param("id"))
	if planID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "missing plan id"})
	}

	var req planReq
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid json"})
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "name is required"})
	}
	if req.PriceCents < 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "priceCents must be >= 0"})
	}
	if req.FeaturesJSON == "" {
		req.FeaturesJSON = "[]"
	}

	q := a.db.Rebind(`UPDATE plans SET name = ?, price_cents = ?, features_json = ? WHERE id = ?`)
	if _, err := a.db.Exec(q, req.Name, req.PriceCents, req.FeaturesJSON, planID); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]any{"ok": true})
}

func (a *AdminAPIService) DeletePlan(c echo.Context) error {
	planID := strings.TrimSpace(c.Param("id"))
	if planID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "missing plan id"})
	}

	// Guard: don't delete plans that are referenced by subscriptions
	var cnt int
	q1 := a.db.Rebind(`SELECT COUNT(1) FROM subscriptions WHERE plan_id = ?`)
	if err := a.db.Get(&cnt, q1, planID); err == nil && cnt > 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "plan has subscriptions; move users first"})
	}

	q := a.db.Rebind(`DELETE FROM plans WHERE id = ?`)
	if _, err := a.db.Exec(q, planID); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]any{"ok": true})
}
