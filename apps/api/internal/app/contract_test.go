package app_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"example.com/quevo/apps/api/internal/apidocs"
	"example.com/quevo/apps/api/internal/app"
	"github.com/getkin/kin-openapi/openapi3"
	"github.com/getkin/kin-openapi/openapi3filter"
	"github.com/getkin/kin-openapi/routers/gorillamux"
	"go.uber.org/zap"
)

func TestHealthProviderMatchesOpenAPI(t *testing.T) {
	ctx := context.Background()
	doc, err := openapi3.NewLoader().LoadFromData(apidocs.Spec)
	if err != nil {
		t.Fatalf("load OpenAPI document: %v", err)
	}
	if err := doc.Validate(ctx); err != nil {
		t.Fatalf("validate OpenAPI document: %v", err)
	}

	contractRouter, err := gorillamux.NewRouter(doc)
	if err != nil {
		t.Fatalf("create OpenAPI router: %v", err)
	}
	contractRequest := httptest.NewRequest(http.MethodGet, "http://api.test/api/v1/health", nil)
	route, pathParams, err := contractRouter.FindRoute(contractRequest)
	if err != nil {
		t.Fatalf("match request to OpenAPI route: %v", err)
	}
	requestInput := &openapi3filter.RequestValidationInput{
		Request:    contractRequest,
		PathParams: pathParams,
		Route:      route,
	}
	if err := openapi3filter.ValidateRequest(ctx, requestInput); err != nil {
		t.Fatalf("validate health request: %v", err)
	}

	response := httptest.NewRecorder()
	providerRequest := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)
	app.NewRouter(zap.NewNop()).ServeHTTP(response, providerRequest)

	responseInput := &openapi3filter.ResponseValidationInput{
		RequestValidationInput: requestInput,
		Status:                 response.Code,
		Header:                 response.Header(),
	}
	responseInput.SetBodyBytes(response.Body.Bytes())
	if err := openapi3filter.ValidateResponse(ctx, responseInput); err != nil {
		t.Fatalf("validate health response: %v", err)
	}
}
