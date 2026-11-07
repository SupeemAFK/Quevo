//go:build integration

package queue

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"example.com/quevo/apps/api/internal/apidocs"
	"example.com/quevo/apps/api/internal/auth"
	"example.com/quevo/apps/api/internal/platform/database"
	"github.com/getkin/kin-openapi/openapi3"
	"github.com/getkin/kin-openapi/openapi3filter"
	"github.com/getkin/kin-openapi/routers/gorillamux"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

func TestCustomerQueueAPIWithPostgres(t *testing.T) {
	ctx, gormDB, sqlDB := newSeededPostgresDB(t)
	passwordHash, err := bcrypt.GenerateFromPassword([]byte("local-demo-password"), bcrypt.MinCost)
	if err != nil {
		t.Fatalf("hash test password: %v", err)
	}
	for _, userID := range []string{database.DemoCustomerID, database.DemoOperatorID} {
		if _, err := sqlDB.ExecContext(ctx, `UPDATE users SET password_hash = $1 WHERE id = $2`, passwordHash, userID); err != nil {
			t.Fatalf("set test account password: %v", err)
		}
	}
	if _, err := sqlDB.ExecContext(ctx, `UPDATE branches SET timezone = 'Asia/Bangkok' WHERE id = $1`, database.DemoBranchID); err != nil {
		t.Fatalf("set demo branch timezone: %v", err)
	}

	inactiveServiceID := uuid.NewString()
	if _, err := sqlDB.ExecContext(ctx, `INSERT INTO services (id, branch_id, name, active)
		VALUES ($1, $2, 'Inactive Service', false)`, inactiveServiceID, database.DemoBranchID); err != nil {
		t.Fatalf("seed inactive service: %v", err)
	}
	otherCustomerID := uuid.NewString()
	if _, err := sqlDB.ExecContext(ctx, `INSERT INTO users (id, role, display_name, email, password_hash)
		VALUES ($1, 'CUSTOMER', 'Other Customer', 'other-customer@quevo.local', $2)`, otherCustomerID, passwordHash); err != nil {
		t.Fatalf("seed second customer: %v", err)
	}

	authService := auth.NewService(auth.NewGORMRepository(gormDB), time.Hour)
	gin.SetMode(gin.TestMode)
	router := gin.New()
	api := router.Group("/api/v1")
	auth.RegisterRoutes(api, authService)
	RegisterRoutes(api, authService, NewRepository(gormDB))
	contractDoc, err := openapi3.NewLoader().LoadFromData(apidocs.Spec)
	if err != nil {
		t.Fatalf("load OpenAPI contract: %v", err)
	}
	if err := contractDoc.Validate(ctx); err != nil {
		t.Fatalf("validate OpenAPI contract: %v", err)
	}
	contractRouter, err := gorillamux.NewRouter(contractDoc)
	if err != nil {
		t.Fatalf("create OpenAPI router: %v", err)
	}
	assertContractResponse := func(method, path string, response *httptest.ResponseRecorder) {
		t.Helper()
		contractRequest := httptest.NewRequest(method, "http://api.test"+path, nil)
		route, pathParams, err := contractRouter.FindRoute(contractRequest)
		if err != nil {
			t.Fatalf("match OpenAPI route for %s %s: %v", method, path, err)
		}
		requestInput := &openapi3filter.RequestValidationInput{
			Request:    contractRequest,
			PathParams: pathParams,
			Route:      route,
			Options:    &openapi3filter.Options{AuthenticationFunc: openapi3filter.NoopAuthenticationFunc},
		}
		if err := openapi3filter.ValidateRequest(ctx, requestInput); err != nil {
			t.Fatalf("validate %s %s request: %v", method, path, err)
		}
		responseInput := &openapi3filter.ResponseValidationInput{
			RequestValidationInput: requestInput,
			Status:                 response.Code,
			Header:                 response.Header(),
		}
		responseInput.SetBodyBytes(response.Body.Bytes())
		if err := openapi3filter.ValidateResponse(ctx, responseInput); err != nil {
			t.Fatalf("validate %s %s response: %v", method, path, err)
		}
	}

	if response := queueAPIRequest(router, http.MethodGet, "/api/v1/services", nil, ""); response.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous service-list status = %d, want %d", response.Code, http.StatusUnauthorized)
	}

	customerSession := loginQueueAPIUser(t, router, "customer@quevo.local")
	services := queueAPIRequest(router, http.MethodGet, "/api/v1/services", nil, customerSession)
	if services.Code != http.StatusOK {
		t.Fatalf("service-list status = %d, want %d: %s", services.Code, http.StatusOK, services.Body.String())
	}
	assertContractResponse(http.MethodGet, "/api/v1/services", services)
	var serviceList ServicesResponse
	if err := json.Unmarshal(services.Body.Bytes(), &serviceList); err != nil {
		t.Fatalf("decode service list: %v", err)
	}
	if len(serviceList.Items) != 1 || serviceList.Items[0].ID != database.DemoServiceID {
		t.Fatalf("available services = %#v; want only the seeded active service", serviceList.Items)
	}

	joinPath := "/api/v1/branches/" + database.DemoBranchID + "/services/" + database.DemoServiceID + "/tickets"
	joined := queueAPIRequest(router, http.MethodPost, joinPath, nil, customerSession)
	if joined.Code != http.StatusCreated {
		t.Fatalf("join status = %d, want %d: %s", joined.Code, http.StatusCreated, joined.Body.String())
	}
	assertContractResponse(http.MethodPost, joinPath, joined)
	var ticket TicketResponse
	if err := json.Unmarshal(joined.Body.Bytes(), &ticket); err != nil {
		t.Fatalf("decode joined ticket: %v", err)
	}
	if ticket.ID == "" || ticket.TicketNumber != "1" || ticket.Status != "WAITING" || ticket.BranchName != "Quevo Demo Branch" || ticket.ServiceName != "General Service" {
		t.Fatalf("joined ticket = %#v; want first WAITING ticket for the seeded service", ticket)
	}
	var expectedBusinessDate string
	if err := sqlDB.QueryRowContext(ctx, `SELECT (now() AT TIME ZONE timezone)::date::text FROM branches WHERE id = $1`, database.DemoBranchID).Scan(&expectedBusinessDate); err != nil {
		t.Fatalf("read branch-local business date: %v", err)
	}
	if ticket.BusinessDate != expectedBusinessDate {
		t.Fatalf("ticket business date = %q, want branch-local date %q", ticket.BusinessDate, expectedBusinessDate)
	}

	duplicate := queueAPIRequest(router, http.MethodPost, joinPath, nil, customerSession)
	if duplicate.Code != http.StatusConflict || !strings.Contains(duplicate.Body.String(), `"code":"active_ticket_exists"`) {
		t.Fatalf("duplicate join = %d %s; want active-ticket conflict", duplicate.Code, duplicate.Body.String())
	}
	assertContractResponse(http.MethodPost, joinPath, duplicate)
	var ticketCount, lastIssued int64
	if err := sqlDB.QueryRowContext(ctx, `SELECT count(*) FROM tickets WHERE customer_id = $1 AND business_date = $2`, database.DemoCustomerID, ticket.BusinessDate).Scan(&ticketCount); err != nil {
		t.Fatalf("count customer tickets after duplicate: %v", err)
	}
	if err := sqlDB.QueryRowContext(ctx, `SELECT last_issued FROM queue_sequences WHERE branch_id = $1 AND service_id = $2 AND business_date = $3`, database.DemoBranchID, database.DemoServiceID, ticket.BusinessDate).Scan(&lastIssued); err != nil {
		t.Fatalf("read queue number after duplicate: %v", err)
	}
	if ticketCount != 1 || lastIssued != 1 {
		t.Fatalf("duplicate changed persisted data: tickets=%d, last_issued=%d; want 1 and 1", ticketCount, lastIssued)
	}

	for _, unavailableServiceID := range []string{inactiveServiceID, uuid.NewString()} {
		unavailablePath := "/api/v1/branches/" + database.DemoBranchID + "/services/" + unavailableServiceID + "/tickets"
		unavailable := queueAPIRequest(router, http.MethodPost, unavailablePath, nil, customerSession)
		if unavailable.Code != http.StatusNotFound {
			t.Fatalf("unavailable service status = %d, want %d: %s", unavailable.Code, http.StatusNotFound, unavailable.Body.String())
		}
		assertContractResponse(http.MethodPost, unavailablePath, unavailable)
	}

	ticketPath := "/api/v1/tickets/" + ticket.ID
	ownTicket := queueAPIRequest(router, http.MethodGet, ticketPath, nil, customerSession)
	if ownTicket.Code != http.StatusOK || !strings.Contains(ownTicket.Body.String(), `"ticketNumber":"1"`) {
		t.Fatalf("own ticket status = %d: %s", ownTicket.Code, ownTicket.Body.String())
	}
	assertContractResponse(http.MethodGet, ticketPath, ownTicket)

	otherCustomerSession := loginQueueAPIUser(t, router, "other-customer@quevo.local")
	otherTicket := queueAPIRequest(router, http.MethodGet, ticketPath, nil, otherCustomerSession)
	if otherTicket.Code != http.StatusNotFound || strings.Contains(otherTicket.Body.String(), ticket.ID) || strings.Contains(otherTicket.Body.String(), "General Service") || strings.Contains(otherTicket.Body.String(), "WAITING") {
		t.Fatalf("other customer's ticket = %d %s; want safe 404", otherTicket.Code, otherTicket.Body.String())
	}
	assertContractResponse(http.MethodGet, ticketPath, otherTicket)

	wrongBranchPath := "/api/v1/branches/" + uuid.NewString() + "/services/" + database.DemoServiceID + "/tickets"
	wrongBranch := queueAPIRequest(router, http.MethodPost, wrongBranchPath, nil, customerSession)
	if wrongBranch.Code != http.StatusNotFound {
		t.Fatalf("wrong branch join status = %d, want %d", wrongBranch.Code, http.StatusNotFound)
	}
	assertContractResponse(http.MethodPost, wrongBranchPath, wrongBranch)
	if malformed := queueAPIRequest(router, http.MethodGet, "/api/v1/tickets/not-a-uuid", nil, customerSession); malformed.Code != http.StatusBadRequest {
		t.Fatalf("malformed ticket ID status = %d, want %d", malformed.Code, http.StatusBadRequest)
	}

	operatorSession := loginQueueAPIUser(t, router, "operator@quevo.local")
	if services := queueAPIRequest(router, http.MethodGet, "/api/v1/services", nil, operatorSession); services.Code != http.StatusForbidden {
		t.Fatalf("operator service-list status = %d, want %d", services.Code, http.StatusForbidden)
	}
}

func loginQueueAPIUser(t *testing.T, router http.Handler, email string) string {
	t.Helper()
	response := queueAPIRequest(router, http.MethodPost, "/api/v1/auth/login", map[string]string{
		"email": email, "password": "local-demo-password",
	}, "")
	if response.Code != http.StatusOK {
		t.Fatalf("login %s = %d: %s", email, response.Code, response.Body.String())
	}
	var login auth.LoginResponse
	if err := json.Unmarshal(response.Body.Bytes(), &login); err != nil {
		t.Fatalf("decode login for %s: %v", email, err)
	}
	return login.SessionToken
}

func queueAPIRequest(router http.Handler, method, path string, body any, token string) *httptest.ResponseRecorder {
	var encoded []byte
	if body != nil {
		encoded, _ = json.Marshal(body)
	}
	request := httptest.NewRequest(method, path, bytes.NewReader(encoded))
	if body != nil {
		request.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		request.Header.Set("Authorization", "Bearer "+token)
	}
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	return response
}
