package health

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type Response struct {
	Status string `json:"status" binding:"required" example:"healthy"`
}

func RegisterRoutes(routes gin.IRoutes) {
	routes.GET("/health", health)
}

// Health godoc
// @Summary Check API health
// @Description Returns the current health status of the API.
// @Tags health
// @ID getHealth
// @Produce json
// @Success 200 {object} Response
// @Router /health [get]
func health(c *gin.Context) {
	c.JSON(http.StatusOK, Response{Status: "healthy"})
}
