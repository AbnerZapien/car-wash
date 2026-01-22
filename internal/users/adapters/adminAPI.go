package adapters

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/google/uuid"
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
	g.GET("/locations", a.ListLocations)
	g.POST("/locations", a.CreateLocation)
	g.PUT("/locations/:id", a.UpdateLocation)
	g.DELETE("/locations/:id", a.DeleteLocation)
	g.POST("/plans", a.CreatePlan)
	g.PUT("/plans/:id", a.UpdatePlan)
	g.DELETE("/plans/:id", a.DeletePlan)
	g.POST("/plans/:id/reassign", a.ReassignPlan)
	g.GET("/audit", a.ListAudit)
	g.GET("/stats", a.GetStats)
	g.GET("/charts", a.GetCharts)
}

// Admin rule: user role must be "admin"
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

		var role string
		q2 := a.db.Rebind(`SELECT role FROM users WHERE id = ? LIMIT 1`)
		if err := a.db.Get(&role, q2, uid); err != nil {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		}
		if role != "admin" {
			return c.JSON(http.StatusForbidden, map[string]string{"error": "forbidden"})
		}
		c.Set("adminUserID", uid)
		return next(c)
	}
}

type AdminAuditItem struct {
	ID            string `json:"id" db:"id"`
	CreatedAt     string `json:"createdAt" db:"created_at"`
	AdminUserID   int64  `json:"adminUserId" db:"admin_user_id"`
	AdminUsername string `json:"adminUsername" db:"admin_username"`
	Action        string `json:"action" db:"action"`
	EntityType    string `json:"entityType" db:"entity_type"`
	EntityID      string `json:"entityId" db:"entity_id"`
	Detail        string `json:"detail" db:"detail"`
}

func (a *AdminAPIService) audit(c echo.Context, action, entityType, entityID string, detail any) {
	if a.db == nil {
		return
	}
	v := c.Get("adminUserID")
	adminID, ok := v.(int64)
	if !ok || adminID == 0 {
		return
	}

	b, err := json.Marshal(detail)
	if err != nil {
		b = []byte(`{}`)
	}

	q := a.db.Rebind(`
		INSERT INTO admin_audit_log (id, admin_user_id, action, entity_type, entity_id, detail)
		VALUES (?, ?, ?, ?, ?, ?::jsonb)
	`)
	_, _ = a.db.Exec(q, uuid.NewString(), adminID, action, entityType, entityID, string(b))
}

func (a *AdminAPIService) ListAudit(c echo.Context) error {
	limit := 100
	if s := strings.TrimSpace(c.QueryParam("limit")); s != "" {
		if n, err := strconv.Atoi(s); err == nil {
			if n < 1 {
				n = 1
			}
			if n > 500 {
				n = 500
			}
			limit = n
		}
	}

	q := a.db.Rebind(`
		SELECT
			l.id,
			COALESCE(l.created_at::text,'') AS created_at,
			l.admin_user_id,
			COALESCE(u.username,'') AS admin_username,
			l.action,
			l.entity_type,
			l.entity_id,
			COALESCE(l.detail::text,'{}') AS detail
		FROM admin_audit_log l
		LEFT JOIN users u ON u.id = l.admin_user_id
		ORDER BY l.created_at DESC
		LIMIT ?
	`)

	var items []AdminAuditItem
	if err := a.db.Select(&items, q, limit); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]any{"items": items})
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
	// Optional filters
	days := 30
	if ds := strings.TrimSpace(c.QueryParam("days")); ds != "" {
		if v, err := strconv.Atoi(ds); err == nil && v > 0 && v <= 365 {
			days = v
		}
	}
	locationID := strings.TrimSpace(c.QueryParam("locationId"))
	if locationID == "all" {
		locationID = ""
	}

	filterJoin := ""
	filterWhere := ""
	args := []any{}

	// Filter members by "has scan at location in last N days"
	if locationID != "" {
		filterJoin = `
		JOIN (
			SELECT DISTINCT user_id
			FROM wash_events
			WHERE scanned_at >= NOW() - (? * INTERVAL '1 day')
			  AND location_id = ?
		) lu ON lu.user_id = u.id
		`
		args = append(args, days, locationID)
	}

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
		` + filterJoin + `
		LEFT JOIN subscriptions s ON s.user_id = u.id AND s.status = 'active'
		LEFT JOIN plans p ON p.id = s.plan_id
		LEFT JOIN (
			SELECT user_id, COUNT(*) cnt
			FROM wash_events
			GROUP BY user_id
		) w ON w.user_id = u.id
		` + filterWhere + `
		ORDER BY u.id DESC
	`)

	var members []AdminMember
	if err := a.db.Select(&members, q, args...); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]any{"members": members, "days": days, "locationId": locationID})
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
	a.audit(c, "user.delete", "user", idStr, map[string]any{})
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
	a.audit(c, "plan.create", "plan", req.ID, map[string]any{"name": req.Name, "priceCents": req.PriceCents})
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
	a.audit(c, "plan.update", "plan", planID, map[string]any{"name": req.Name, "priceCents": req.PriceCents})
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
		a.audit(c, "plan.delete_blocked", "plan", planID, map[string]any{"subscribers": cnt})
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "plan has subscriptions; move users first"})
	}

	q := a.db.Rebind(`DELETE FROM plans WHERE id = ?`)
	if _, err := a.db.Exec(q, planID); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	a.audit(c, "plan.delete", "plan", planID, map[string]any{})
	return c.JSON(http.StatusOK, map[string]any{"ok": true})
}

type AdminStats struct {
	ActiveMemberCount int     `json:"activeMemberCount"`
	ScansLastNDays    int     `json:"scansLastNDays"`
	AverageUsageRate  float64 `json:"averageUsageRate"`
	MonthlyProjection float64 `json:"monthlyProjection"`
	Days              int     `json:"days"`
}

func (a *AdminAPIService) GetStats(c echo.Context) error {
	days := 30
	if ds := strings.TrimSpace(c.QueryParam("days")); ds != "" {
		if v, err := strconv.Atoi(ds); err == nil && v > 0 && v <= 365 {
			days = v
		}
	}

	locationID := strings.TrimSpace(c.QueryParam("locationId"))
	if locationID == "all" {
		locationID = ""
	}

	// Active members:
	// - No filter: all active subscriptions
	// - Filter: active subs whose users scanned at this location in window
	var active int
	if locationID == "" {
		q1 := a.db.Rebind(`SELECT COUNT(1) FROM subscriptions WHERE status = 'active'`)
		if err := a.db.Get(&active, q1); err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}
	} else {
		q1 := a.db.Rebind(`
			WITH loc_users AS (
				SELECT DISTINCT user_id
				FROM wash_events
				WHERE scanned_at >= NOW() - (? * INTERVAL '1 day')
				  AND location_id = ?
			)
			SELECT COUNT(1)
			FROM subscriptions s
			WHERE s.status = 'active'
			  AND s.user_id IN (SELECT user_id FROM loc_users)
		`)
		if err := a.db.Get(&active, q1, days, locationID); err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}
	}

	// Scans in window, filtered by location if provided
	var scans int
	if locationID == "" {
		q2 := a.db.Rebind(`SELECT COUNT(1) FROM wash_events WHERE scanned_at >= NOW() - (? * INTERVAL '1 day')`)
		if err := a.db.Get(&scans, q2, days); err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}
	} else {
		q2 := a.db.Rebind(`
			SELECT COUNT(1)
			FROM wash_events
			WHERE scanned_at >= NOW() - (? * INTERVAL '1 day')
			  AND location_id = ?
		`)
		if err := a.db.Get(&scans, q2, days, locationID); err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}
	}

	avg := 0.0
	if active > 0 {
		avg = float64(scans) / float64(active)
	}

	// Monthly projection: sum plan price for active subs (filtered users if location specified)
	var cents int
	if locationID == "" {
		q3 := a.db.Rebind(`
			SELECT COALESCE(SUM(p.price_cents), 0)
			FROM subscriptions s
			JOIN plans p ON p.id = s.plan_id
			WHERE s.status = 'active'
		`)
		if err := a.db.Get(&cents, q3); err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}
	} else {
		q3 := a.db.Rebind(`
			WITH loc_users AS (
				SELECT DISTINCT user_id
				FROM wash_events
				WHERE scanned_at >= NOW() - (? * INTERVAL '1 day')
				  AND location_id = ?
			)
			SELECT COALESCE(SUM(p.price_cents), 0)
			FROM subscriptions s
			JOIN plans p ON p.id = s.plan_id
			WHERE s.status = 'active'
			  AND s.user_id IN (SELECT user_id FROM loc_users)
		`)
		if err := a.db.Get(&cents, q3, days, locationID); err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}
	}

	out := AdminStats{
		ActiveMemberCount: active,
		ScansLastNDays:    scans,
		AverageUsageRate:  avg,
		MonthlyProjection: float64(cents) / 100.0,
		Days:              days,
	}
	return c.JSON(http.StatusOK, out)
}

type reassignReq struct {
	ToPlanID string `json:"toPlanId"`
}

func (a *AdminAPIService) ReassignPlan(c echo.Context) error {
	fromPlan := strings.TrimSpace(c.Param("id"))
	if fromPlan == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "missing plan id"})
	}

	var req reassignReq
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid json"})
	}
	toPlan := strings.TrimSpace(req.ToPlanID)
	if toPlan == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "toPlanId required"})
	}
	if toPlan == fromPlan {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "toPlanId must be different"})
	}

	// Validate both plans exist
	var exists int
	qExist := a.db.Rebind(`SELECT 1 FROM plans WHERE id = ? LIMIT 1`)
	if err := a.db.Get(&exists, qExist, fromPlan); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid source plan"})
	}
	if err := a.db.Get(&exists, qExist, toPlan); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid toPlanId"})
	}

	// Move ACTIVE subscriptions from fromPlan -> toPlan
	q := a.db.Rebind(`UPDATE subscriptions SET plan_id = ? WHERE plan_id = ? AND status = 'active'`)
	res, err := a.db.Exec(q, toPlan, fromPlan)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	moved, _ := res.RowsAffected()

	a.audit(c, "plan.reassign", "plan", fromPlan, map[string]any{
		"toPlanId": toPlan,
		"moved":    moved,
	})

	return c.JSON(http.StatusOK, map[string]any{"ok": true, "moved": moved})
}

type AdminLocation struct {
	ID      string `json:"id" db:"id"`
	Name    string `json:"name" db:"name"`
	Address string `json:"address" db:"address"`
}

type locationReq struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Address string `json:"address"`
}

func (a *AdminAPIService) ListLocations(c echo.Context) error {
	q := a.db.Rebind(`SELECT id, name, COALESCE(address,'') AS address FROM locations ORDER BY name ASC`)
	var locs []AdminLocation
	if err := a.db.Select(&locs, q); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]any{"locations": locs})
}

func (a *AdminAPIService) CreateLocation(c echo.Context) error {
	var req locationReq
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid json"})
	}
	req.ID = strings.TrimSpace(req.ID)
	req.Name = strings.TrimSpace(req.Name)
	req.Address = strings.TrimSpace(req.Address)

	if req.ID == "" || req.Name == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "id and name are required"})
	}

	q := a.db.Rebind(`INSERT INTO locations (id, name, address) VALUES (?, ?, ?)`)
	if _, err := a.db.Exec(q, req.ID, req.Name, req.Address); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	a.audit(c, "location.create", "location", req.ID, map[string]any{"name": req.Name, "address": req.Address})
	return c.JSON(http.StatusOK, map[string]any{"ok": true})
}

func (a *AdminAPIService) UpdateLocation(c echo.Context) error {
	locID := strings.TrimSpace(c.Param("id"))
	if locID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "missing location id"})
	}

	var req locationReq
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid json"})
	}
	req.Name = strings.TrimSpace(req.Name)
	req.Address = strings.TrimSpace(req.Address)

	if req.Name == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "name is required"})
	}

	q := a.db.Rebind(`UPDATE locations SET name = ?, address = ? WHERE id = ?`)
	if _, err := a.db.Exec(q, req.Name, req.Address, locID); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	a.audit(c, "location.update", "location", locID, map[string]any{"name": req.Name, "address": req.Address})
	return c.JSON(http.StatusOK, map[string]any{"ok": true})
}

func (a *AdminAPIService) DeleteLocation(c echo.Context) error {
	locID := strings.TrimSpace(c.Param("id"))
	if locID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "missing location id"})
	}

	// Block delete if wash events exist
	var cnt int
	q1 := a.db.Rebind(`SELECT COUNT(1) FROM wash_events WHERE location_id = ?`)
	if err := a.db.Get(&cnt, q1, locID); err == nil && cnt > 0 {
		a.audit(c, "location.delete_blocked", "location", locID, map[string]any{"events": cnt})
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "cannot delete location: wash events exist"})
	}

	q := a.db.Rebind(`DELETE FROM locations WHERE id = ?`)
	if _, err := a.db.Exec(q, locID); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	a.audit(c, "location.delete", "location", locID, map[string]any{})
	return c.JSON(http.StatusOK, map[string]any{"ok": true})
}

type AdminCharts struct {
	Days int `json:"days"`

	Labels             []string  `json:"labels"`
	ScansPerDay        []int     `json:"scansPerDay"`
	UniqueUsersPerDay  []int     `json:"uniqueUsersPerDay"`
	RetentionPctPerDay []float64 `json:"retentionPctPerDay"`

	ActiveMemberCount int     `json:"activeMemberCount"`
	AverageUsageRate  float64 `json:"averageUsageRate"`
	MonthlyProjection float64 `json:"monthlyProjection"`

	PlanMixLabels []string `json:"planMixLabels"`
	PlanMixCounts []int    `json:"planMixCounts"`

	HeatmapLabels    []string `json:"heatmapLabels"` // Mon..Sun
	HeatmapMorning   []int    `json:"heatmapMorning"`
	HeatmapAfternoon []int    `json:"heatmapAfternoon"`
	HeatmapEvening   []int    `json:"heatmapEvening"`
}

func (a *AdminAPIService) GetCharts(c echo.Context) error {
	days := 30
	if ds := strings.TrimSpace(c.QueryParam("days")); ds != "" {
		if v, err := strconv.Atoi(ds); err == nil && v > 0 && v <= 365 {
			days = v
		}
	}

	locationID := strings.TrimSpace(c.QueryParam("locationId"))
	if locationID == "all" {
		locationID = ""
	}

	// Active members: if filtering, scope to users who scanned at that location in window.
	var active int
	if locationID == "" {
		q := a.db.Rebind(`SELECT COUNT(1) FROM subscriptions WHERE status = 'active'`)
		if err := a.db.Get(&active, q); err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}
	} else {
		q := a.db.Rebind(`
			WITH loc_users AS (
				SELECT DISTINCT user_id
				FROM wash_events
				WHERE scanned_at >= NOW() - (? * INTERVAL '1 day')
				  AND location_id = ?
			)
			SELECT COUNT(1)
			FROM subscriptions s
			WHERE s.status = 'active'
			  AND s.user_id IN (SELECT user_id FROM loc_users)
		`)
		if err := a.db.Get(&active, q, days, locationID); err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}
	}

	// Monthly projection cents (filtered users if location specified)
	var cents int
	if locationID == "" {
		q := a.db.Rebind(`
			SELECT COALESCE(SUM(p.price_cents), 0)
			FROM subscriptions s
			JOIN plans p ON p.id = s.plan_id
			WHERE s.status = 'active'
		`)
		if err := a.db.Get(&cents, q); err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}
	} else {
		q := a.db.Rebind(`
			WITH loc_users AS (
				SELECT DISTINCT user_id
				FROM wash_events
				WHERE scanned_at >= NOW() - (? * INTERVAL '1 day')
				  AND location_id = ?
			)
			SELECT COALESCE(SUM(p.price_cents), 0)
			FROM subscriptions s
			JOIN plans p ON p.id = s.plan_id
			WHERE s.status = 'active'
			  AND s.user_id IN (SELECT user_id FROM loc_users)
		`)
		if err := a.db.Get(&cents, q, days, locationID); err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}
	}

	// Daily series (location-filtered if provided)
	type dayRow struct {
		Day   string `db:"day"`
		Scans int    `db:"scans"`
		Users int    `db:"users"`
	}

	whereLoc := ""
	argsLoc := make([]any, 0, 1)
	if locationID != "" {
		whereLoc = " AND location_id = ?"
		argsLoc = append(argsLoc, locationID)
	}

	qDailySQL := `
		WITH days AS (
			SELECT generate_series(
				current_date - ((?::int - 1) * interval '1 day'),
				current_date,
				interval '1 day'
			)::date AS day
		),
		agg AS (
			SELECT
				date(scanned_at) AS day,
				COUNT(*) AS scans,
				COUNT(DISTINCT user_id) AS users
			FROM wash_events
			WHERE scanned_at >= NOW() - (?::int * interval '1 day')` + whereLoc + `
			GROUP BY 1
		)
		SELECT
			d.day::text AS day,
			COALESCE(a.scans, 0) AS scans,
			COALESCE(a.users, 0) AS users
		FROM days d
		LEFT JOIN agg a ON a.day = d.day
		ORDER BY d.day ASC
	`
	qDaily := a.db.Rebind(qDailySQL)

	argsDaily := append([]any{days, days}, argsLoc...)
	var rows []dayRow
	if err := a.db.Select(&rows, qDaily, argsDaily...); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	labels := make([]string, 0, len(rows))
	scansPerDay := make([]int, 0, len(rows))
	uniqueUsers := make([]int, 0, len(rows))
	retention := make([]float64, 0, len(rows))

	totalScans := 0
	for _, r := range rows {
		labels = append(labels, r.Day)
		scansPerDay = append(scansPerDay, r.Scans)
		uniqueUsers = append(uniqueUsers, r.Users)
		totalScans += r.Scans
		if active > 0 {
			retention = append(retention, (float64(r.Users)/float64(active))*100.0)
		} else {
			retention = append(retention, 0)
		}
	}

	avgUsage := 0.0
	if active > 0 {
		avgUsage = float64(totalScans) / float64(active)
	}

	// Plan mix (filtered users if location specified)
	type mixRow struct {
		Name string `db:"name"`
		Cnt  int    `db:"cnt"`
	}
	var mix []mixRow
	if locationID == "" {
		qMix := a.db.Rebind(`
			SELECT p.name, COUNT(*) AS cnt
			FROM subscriptions s
			JOIN plans p ON p.id = s.plan_id
			WHERE s.status = 'active'
			GROUP BY p.name
			ORDER BY cnt DESC
		`)
		_ = a.db.Select(&mix, qMix)
	} else {
		qMix := a.db.Rebind(`
			WITH loc_users AS (
				SELECT DISTINCT user_id
				FROM wash_events
				WHERE scanned_at >= NOW() - (? * INTERVAL '1 day')
				  AND location_id = ?
			)
			SELECT p.name, COUNT(*) AS cnt
			FROM subscriptions s
			JOIN plans p ON p.id = s.plan_id
			WHERE s.status = 'active'
			  AND s.user_id IN (SELECT user_id FROM loc_users)
			GROUP BY p.name
			ORDER BY cnt DESC
		`)
		_ = a.db.Select(&mix, qMix, days, locationID)
	}

	planLabels := []string{}
	planCounts := []int{}
	for _, r := range mix {
		planLabels = append(planLabels, r.Name)
		planCounts = append(planCounts, r.Cnt)
	}

	// Heatmap (last 7 days), location-filtered if provided
	heatLabels := []string{"Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"}
	morn := make([]int, 7)
	aft := make([]int, 7)
	eve := make([]int, 7)

	type heatRow struct {
		Dow     int    `db:"dow"`
		Segment string `db:"segment"`
		Cnt     int    `db:"cnt"`
	}

	heatWhere := ""
	heatArgs := make([]any, 0, 1)
	if locationID != "" {
		heatWhere = " AND location_id = ?"
		heatArgs = append(heatArgs, locationID)
	}

	qHeatSQL := `
		SELECT
			(EXTRACT(DOW FROM scanned_at)::int) AS dow,
			CASE
				WHEN EXTRACT(HOUR FROM scanned_at) < 12 THEN 'Morning'
				WHEN EXTRACT(HOUR FROM scanned_at) < 18 THEN 'Afternoon'
				ELSE 'Evening'
			END AS segment,
			COUNT(*) AS cnt
		FROM wash_events
		WHERE scanned_at >= NOW() - (7 * interval '1 day')` + heatWhere + `
		GROUP BY 1, 2
	`
	qHeat := a.db.Rebind(qHeatSQL)

	var heat []heatRow
	_ = a.db.Select(&heat, qHeat, heatArgs...)

	// Postgres DOW: 0=Sun..6=Sat. We want 0=Mon..6=Sun
	mapDow := func(pgDow int) int {
		if pgDow == 0 {
			return 6
		}
		return pgDow - 1
	}

	for _, r := range heat {
		i := mapDow(r.Dow)
		if i < 0 || i > 6 {
			continue
		}
		switch r.Segment {
		case "Morning":
			morn[i] = r.Cnt
		case "Afternoon":
			aft[i] = r.Cnt
		default:
			eve[i] = r.Cnt
		}
	}

	out := AdminCharts{
		Days: days,

		Labels:             labels,
		ScansPerDay:        scansPerDay,
		UniqueUsersPerDay:  uniqueUsers,
		RetentionPctPerDay: retention,

		ActiveMemberCount: active,
		AverageUsageRate:  avgUsage,
		MonthlyProjection: float64(cents) / 100.0,

		PlanMixLabels: planLabels,
		PlanMixCounts: planCounts,

		HeatmapLabels:    heatLabels,
		HeatmapMorning:   morn,
		HeatmapAfternoon: aft,
		HeatmapEvening:   eve,
	}

	return c.JSON(http.StatusOK, out)
}
