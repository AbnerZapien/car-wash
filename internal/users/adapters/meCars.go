package adapters

import (
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
)

type carRow struct {
	ID        string `db:"id" json:"id"`
	UserID    int64  `db:"user_id" json:"userId"`
	Nickname  string `db:"nickname" json:"nickname"`
	VIN       string `db:"vin" json:"vin"`
	Year      *int   `db:"year" json:"year"`
	Make      string `db:"make" json:"make"`
	Model     string `db:"model" json:"model"`
	Trim      string `db:"trim" json:"trim"`
	Color     string `db:"color" json:"color"`
	Plate     string `db:"plate" json:"plate"`
	CreatedAt string `db:"created_at" json:"createdAt"`
	UpdatedAt string `db:"updated_at" json:"updatedAt"`
}

type carUpsertReq struct {
	Nickname string `json:"nickname"`
	VIN      string `json:"vin"`
	Year     *int   `json:"year"`
	Make     string `json:"make"`
	Model    string `json:"model"`
	Trim     string `json:"trim"`
	Color    string `json:"color"`
	Plate    string `json:"plate"`
}

func normalizeVIN(v string) string {
	v = strings.ToUpper(strings.TrimSpace(v))
	v = strings.ReplaceAll(v, " ", "")
	return v
}

func (m *MeAPIService) ListMyCars(c echo.Context) error {
	if m.db == nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "db not configured"})
	}
	uid, ok := m.authedUserID(c)
	if !ok {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
	}

	q := m.db.Rebind(`
		SELECT id, user_id, nickname, vin, year, make, model, trim, color, plate,
		       COALESCE(created_at::text,'') AS created_at,
		       COALESCE(updated_at::text,'') AS updated_at
		FROM cars
		WHERE user_id = ?
		ORDER BY created_at DESC
	`)
	var cars []carRow
	if err := m.db.Select(&cars, q, uid); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	if cars == nil {
		cars = []carRow{}
	}
	return c.JSON(http.StatusOK, map[string]any{"cars": cars})
}

func (m *MeAPIService) CreateMyCar(c echo.Context) error {
	if m.db == nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "db not configured"})
	}
	uid, ok := m.authedUserID(c)
	if !ok {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
	}

	var req carUpsertReq
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid json"})
	}

	req.Nickname = strings.TrimSpace(req.Nickname)
	req.VIN = normalizeVIN(req.VIN)
	req.Make = strings.TrimSpace(req.Make)
	req.Model = strings.TrimSpace(req.Model)
	req.Trim = strings.TrimSpace(req.Trim)
	req.Color = strings.TrimSpace(req.Color)
	req.Plate = strings.TrimSpace(req.Plate)

	// Minimal validation:
	// - VIN optional
	// - If VIN is empty, require at least make+model (year optional)
	if req.VIN == "" {
		if req.Make == "" || req.Model == "" {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "make and model are required if VIN is not provided"})
		}
	}
	if req.VIN != "" && len(req.VIN) != 17 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "VIN must be 17 characters"})
	}
	if req.Year != nil {
		y := *req.Year
		ny := time.Now().Year() + 1
		if y < 1980 || y > ny {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "year out of range"})
		}
	}

	id := uuid.NewString()
	q := m.db.Rebind(`
		INSERT INTO cars (id, user_id, nickname, vin, year, make, model, trim, color, plate)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`)
	if _, err := m.db.Exec(q, id, uid, req.Nickname, req.VIN, req.Year, req.Make, req.Model, req.Trim, req.Color, req.Plate); err != nil {
		if isUniqueViolation(err) {
			return c.JSON(http.StatusConflict, map[string]string{"error": "Car already exists (VIN or plate)."})
		}
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}

	// Return created record
	var out carRow
	q2 := m.db.Rebind(`
		SELECT id, user_id, nickname, vin, year, make, model, trim, color, plate,
		       COALESCE(created_at::text,'') AS created_at,
		       COALESCE(updated_at::text,'') AS updated_at
		FROM cars
		WHERE id = ? AND user_id = ?
		LIMIT 1
	`)
	_ = m.db.Get(&out, q2, id, uid)
	return c.JSON(http.StatusOK, out)
}

func (m *MeAPIService) UpdateMyCar(c echo.Context) error {
	if m.db == nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "db not configured"})
	}
	uid, ok := m.authedUserID(c)
	if !ok {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
	}

	carID := strings.TrimSpace(c.Param("id"))
	if carID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "missing car id"})
	}

	var req carUpsertReq
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid json"})
	}

	req.Nickname = strings.TrimSpace(req.Nickname)
	req.VIN = normalizeVIN(req.VIN)
	req.Make = strings.TrimSpace(req.Make)
	req.Model = strings.TrimSpace(req.Model)
	req.Trim = strings.TrimSpace(req.Trim)
	req.Color = strings.TrimSpace(req.Color)
	req.Plate = strings.TrimSpace(req.Plate)

	if req.VIN != "" && len(req.VIN) != 17 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "VIN must be 17 characters"})
	}
	if req.Year != nil {
		y := *req.Year
		ny := time.Now().Year() + 1
		if y < 1980 || y > ny {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "year out of range"})
		}
	}

	q := m.db.Rebind(`
		UPDATE cars
		SET nickname = ?,
		    vin = ?,
		    year = ?,
		    make = ?,
		    model = ?,
		    trim = ?,
		    color = ?,
		    plate = ?,
		    updated_at = NOW()
		WHERE id = ? AND user_id = ?
	`)
	res, err := m.db.Exec(q, req.Nickname, req.VIN, req.Year, req.Make, req.Model, req.Trim, req.Color, req.Plate, carID, uid)
	if err != nil {

		if isUniqueViolation(err) {
			return c.JSON(http.StatusConflict, map[string]string{"error": "Car already exists (VIN or plate)."})
		}
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "car not found"})
	}

	var out carRow
	q2 := m.db.Rebind(`
		SELECT id, user_id, nickname, vin, year, make, model, trim, color, plate,
		       COALESCE(created_at::text,'') AS created_at,
		       COALESCE(updated_at::text,'') AS updated_at
		FROM cars
		WHERE id = ? AND user_id = ?
		LIMIT 1
	`)
	if err := m.db.Get(&out, q2, carID, uid); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to fetch updated car"})
	}
	return c.JSON(http.StatusOK, out)
}

func (m *MeAPIService) DeleteMyCar(c echo.Context) error {
	if m.db == nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "db not configured"})
	}
	uid, ok := m.authedUserID(c)
	if !ok {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
	}

	carID := strings.TrimSpace(c.Param("id"))
	if carID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "missing car id"})
	}

	q := m.db.Rebind(`DELETE FROM cars WHERE id = ? AND user_id = ?`)
	res, err := m.db.Exec(q, carID, uid)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	n, _ := res.RowsAffected()
	if n == 0 {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "car not found"})
	}

	return c.JSON(http.StatusOK, map[string]any{"ok": true})
}

func isUniqueViolation(err error) bool {
	if err == nil {
		return false
	}
	s := err.Error()
	// Postgres unique violation
	if strings.Contains(s, "SQLSTATE 23505") {
		return true
	}
	// Extra fallback matching (just in case)
	ls := strings.ToLower(s)
	return strings.Contains(ls, "duplicate key") || strings.Contains(ls, "unique constraint")
}
