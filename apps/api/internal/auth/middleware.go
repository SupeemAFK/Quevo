package auth

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

func RequireSession(service *Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		if service == nil {
			writeError(c, http.StatusServiceUnavailable, "service_unavailable", "Authentication is temporarily unavailable")
			c.Abort()
			return
		}
		token, ok := bearerToken(c)
		if !ok {
			writeError(c, http.StatusUnauthorized, "unauthorized", "Authentication is required")
			c.Abort()
			return
		}
		actor, err := service.Authenticate(c.Request.Context(), token)
		if errors.Is(err, ErrUnauthenticated) {
			writeError(c, http.StatusUnauthorized, "unauthorized", "Authentication is required")
			c.Abort()
			return
		}
		if err != nil {
			writeError(c, http.StatusInternalServerError, "internal_error", "The request could not be completed")
			c.Abort()
			return
		}
		c.Set(actorContextKey, actor)
		c.Next()
	}
}

func RequireRoles(roles ...Role) gin.HandlerFunc {
	return func(c *gin.Context) {
		actor, ok := ActorFromContext(c)
		if !ok {
			writeError(c, http.StatusUnauthorized, "unauthorized", "Authentication is required")
			c.Abort()
			return
		}
		for _, role := range roles {
			if actor.Role == role {
				c.Next()
				return
			}
		}
		writeError(c, http.StatusForbidden, "forbidden", "You do not have permission to perform this action")
		c.Abort()
	}
}

func RequireOperatorService(service *Service, serviceIDParam string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if service == nil {
			writeError(c, http.StatusServiceUnavailable, "service_unavailable", "Authentication is temporarily unavailable")
			c.Abort()
			return
		}
		actor, ok := ActorFromContext(c)
		if !ok {
			writeError(c, http.StatusUnauthorized, "unauthorized", "Authentication is required")
			c.Abort()
			return
		}
		err := service.AuthorizeOperatorService(c.Request.Context(), actor, c.Param(serviceIDParam))
		if errors.Is(err, ErrForbidden) {
			writeError(c, http.StatusForbidden, "forbidden", "You do not have permission to access this queue")
			c.Abort()
			return
		}
		if err != nil {
			writeError(c, http.StatusInternalServerError, "internal_error", "The request could not be completed")
			c.Abort()
			return
		}
		c.Next()
	}
}

const actorContextKey = "quevo.auth.actor"

func ActorFromContext(c *gin.Context) (Actor, bool) {
	actor, ok := c.Get(actorContextKey)
	if !ok {
		return Actor{}, false
	}
	identity, ok := actor.(Actor)
	return identity, ok
}

func bearerToken(c *gin.Context) (string, bool) {
	header := c.GetHeader("Authorization")
	if len(header) < len("Bearer ") || !strings.EqualFold(header[:len("Bearer ")], "Bearer ") {
		return "", false
	}
	token := strings.TrimSpace(header[len("Bearer "):])
	return token, token != ""
}
