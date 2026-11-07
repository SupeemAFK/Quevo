package app

import (
	"fmt"
	"net/http"
	"time"

	"example.com/quevo/apps/api/internal/auth"
	"example.com/quevo/apps/api/internal/platform/config"
	"example.com/quevo/apps/api/internal/platform/database"
	"example.com/quevo/apps/api/internal/queue"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type App struct {
	server *http.Server
	db     *gorm.DB
}

func New(cfg config.Config, logger *zap.Logger) (*App, error) {
	var db *gorm.DB
	if cfg.DatabaseURL != "" {
		var err error
		db, err = database.Open(cfg.DatabaseURL, database.PoolConfig{
			MaxIdleConns:    cfg.DBMaxIdleConns,
			MaxOpenConns:    cfg.DBMaxOpenConns,
			ConnMaxLifetime: cfg.DBConnMaxLifetime,
		})
		if err != nil {
			return nil, fmt.Errorf("initialize PostgreSQL connection: %w", err)
		}
	}

	var authService *auth.Service
	var queueRepository *queue.Repository
	if db != nil {
		authService = auth.NewService(auth.NewGORMRepository(db), cfg.SessionTTL)
		queueRepository = queue.NewRepository(db)
	}

	server := &http.Server{
		Addr:              fmt.Sprintf(":%d", cfg.Port),
		Handler:           NewRouter(logger, authService, queueRepository),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	return &App{server: server, db: db}, nil
}

func (a *App) HTTPServer() *http.Server {
	return a.server
}

func (a *App) Close() error {
	if a.db == nil {
		return nil
	}

	sqlDB, err := a.db.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}
