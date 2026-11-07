package health_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"example.com/quevo/apps/api/internal/app"
	"go.uber.org/zap"
)

func TestHealthRoute(t *testing.T) {
	router := app.NewRouter(zap.NewNop(), nil, nil)
	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)

	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusOK)
	}
	if contentType := response.Header().Get("Content-Type"); !strings.Contains(contentType, "application/json") {
		t.Fatalf("Content-Type = %q, want application/json", contentType)
	}

	var body struct {
		Status string `json:"status"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.Status != "healthy" {
		t.Fatalf("message = %q, want %q", body.Status, "healthy")
	}
}

func TestUnknownRouteReturnsNotFound(t *testing.T) {
	router := app.NewRouter(zap.NewNop(), nil, nil)
	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/v1/unknown", nil)

	router.ServeHTTP(response, request)

	if response.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusNotFound)
	}
}
