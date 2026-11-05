package app

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/swaggest/swgui/v5emb"
	"go.uber.org/zap"

	"example.com/quevo/apps/api/internal/apidocs"
	"example.com/quevo/apps/api/internal/health"
	"example.com/quevo/apps/api/internal/middleware"
)

func NewRouter(logger *zap.Logger) *gin.Engine {
	gin.SetMode(gin.ReleaseMode)
	router := gin.New()
	router.Use(middleware.ZapRequestLogger(logger), middleware.ZapRecovery(logger))

	api := router.Group("/api/v1")
	health.RegisterRoutes(api)

	router.GET("/openapi.json", func(c *gin.Context) {
		c.Data(http.StatusOK, "application/json; charset=utf-8", apidocs.Spec)
	})

	swaggerUI := v5emb.New("Quevo API", "/openapi.json", "/swagger/")
	router.GET("/swagger", func(c *gin.Context) {
		c.Redirect(http.StatusMovedPermanently, "/swagger/")
	})
	router.Any("/swagger/*any", gin.WrapH(swaggerUI))

	return router
}
