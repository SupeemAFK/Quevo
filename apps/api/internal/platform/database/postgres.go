package database

import (
	"fmt"
	"strings"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

type PoolConfig struct {
	MaxIdleConns    int
	MaxOpenConns    int
	ConnMaxLifetime time.Duration
}

func Open(databaseURL string, pool PoolConfig) (*gorm.DB, error) {
	databaseURL = strings.TrimSpace(databaseURL)
	if databaseURL == "" {
		return nil, fmt.Errorf("database URL is required")
	}
	if pool.MaxOpenConns < 1 {
		return nil, fmt.Errorf("maximum open connections must be greater than 0")
	}
	if pool.MaxIdleConns < 0 || pool.MaxIdleConns > pool.MaxOpenConns {
		return nil, fmt.Errorf("maximum idle connections must be between 0 and maximum open connections")
	}
	if pool.ConnMaxLifetime <= 0 {
		return nil, fmt.Errorf("connection maximum lifetime must be greater than 0")
	}

	db, err := gorm.Open(postgres.Open(databaseURL), &gorm.Config{
		DisableAutomaticPing: true,
	})
	if err != nil {
		return nil, fmt.Errorf("open GORM PostgreSQL connection: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("get PostgreSQL connection pool: %w", err)
	}
	sqlDB.SetMaxIdleConns(pool.MaxIdleConns)
	sqlDB.SetMaxOpenConns(pool.MaxOpenConns)
	sqlDB.SetConnMaxLifetime(pool.ConnMaxLifetime)

	return db, nil
}
