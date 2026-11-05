package middleware

import (
	"net/http"
	"runtime/debug"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func ZapRequestLogger(logger *zap.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		started := time.Now()
		c.Next()

		route := c.FullPath()
		if route == "" {
			route = "unmatched"
		}

		fields := []zap.Field{
			zap.String("method", c.Request.Method),
			zap.String("route", route),
			zap.Int("status", c.Writer.Status()),
			zap.Duration("latency", time.Since(started)),
		}
		if c.Writer.Status() >= http.StatusInternalServerError {
			logger.Error("HTTP request", fields...)
			return
		}
		logger.Info("HTTP request", fields...)
	}
}

func ZapRecovery(logger *zap.Logger) gin.HandlerFunc {
	return gin.CustomRecovery(func(c *gin.Context, recovered any) {
		logger.Error("panic recovered",
			zap.Any("error", recovered),
			zap.String("route", c.FullPath()),
			zap.ByteString("stack", debug.Stack()),
		)
		c.AbortWithStatus(http.StatusInternalServerError)
	})
}
