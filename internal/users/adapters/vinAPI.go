package adapters

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
)

type VINAPIService struct {
	httpService *echo.Group
	client      *http.Client
}

func NewVINAPIService(httpService *echo.Group) *VINAPIService {
	return &VINAPIService{
		httpService: httpService,
		client: &http.Client{
			Timeout: 8 * time.Second,
		},
	}
}

func (s *VINAPIService) RegisterRoutes() {
	// Public helper endpoint (no auth) used by the My Cars UI.
	s.httpService.GET("/vin/decode", s.DecodeVIN)
}

var vinRe = regexp.MustCompile(`^[A-HJ-NPR-Z0-9]{17}$`) // excludes I,O,Q

type vpicResponse struct {
	Results []map[string]any `json:"Results"`
}

type VINDecodeOut struct {
	VIN   string `json:"vin"`
	Year  int    `json:"year,omitempty"`
	Make  string `json:"make,omitempty"`
	Model string `json:"model,omitempty"`
	Trim  string `json:"trim,omitempty"`

	// Optional debug fields
	Source string `json:"source"`
}

func (s *VINAPIService) DecodeVIN(c echo.Context) error {
	vin := strings.ToUpper(strings.TrimSpace(c.QueryParam("vin")))
	if vin == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "missing vin"})
	}
	if !vinRe.MatchString(vin) {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "vin must be 17 chars (A-H,J-N,P,R-Z,0-9)"})
	}

	// NHTSA vPIC endpoint (no key)
	url := fmt.Sprintf("https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/%s?format=json", vin)

	req, err := http.NewRequestWithContext(c.Request().Context(), http.MethodGet, url, nil)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "request build failed"})
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return c.JSON(http.StatusBadGateway, map[string]string{"error": "vin decode service unavailable"})
	}
	defer resp.Body.Close()

	b, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return c.JSON(http.StatusBadGateway, map[string]string{"error": "vin decode service error"})
	}

	var v vpicResponse
	if err := json.Unmarshal(b, &v); err != nil || len(v.Results) == 0 {
		return c.JSON(http.StatusBadGateway, map[string]string{"error": "invalid vin decode response"})
	}

	// vPIC returns one result object with many fields
	r := v.Results[0]

	getStr := func(k string) string {
		x, ok := r[k]
		if !ok || x == nil {
			return ""
		}
		s := strings.TrimSpace(fmt.Sprint(x))
		if s == "0" || strings.EqualFold(s, "Not Applicable") {
			return ""
		}
		return s
	}

	yearStr := getStr("ModelYear")
	year := 0
	if yearStr != "" {
		if n, err := strconv.Atoi(yearStr); err == nil {
			year = n
		}
	}

	out := VINDecodeOut{
		VIN:    vin,
		Year:   year,
		Make:   getStr("Make"),
		Model:  getStr("Model"),
		Trim:   getStr("Trim"),
		Source: "NHTSA vPIC",
	}

	// If everything is empty, treat as invalid/unknown VIN
	if out.Year == 0 && out.Make == "" && out.Model == "" && out.Trim == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "vin not recognized"})
	}

	return c.JSON(http.StatusOK, out)
}
