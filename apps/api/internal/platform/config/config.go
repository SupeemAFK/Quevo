package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Port              int
	DatabaseURL       string
	DBMaxIdleConns    int
	DBMaxOpenConns    int
	DBConnMaxLifetime time.Duration
	SessionTTL        time.Duration
}

func Load() (Config, error) {
	cfg := Config{
		Port:              8080,
		DBMaxIdleConns:    5,
		DBMaxOpenConns:    10,
		DBConnMaxLifetime: 30 * time.Minute,
		SessionTTL:        12 * time.Hour,
		DatabaseURL:       strings.TrimSpace(os.Getenv("DATABASE_URL")),
	}

	var err error
	if cfg.Port, err = intFromEnv("PORT", cfg.Port); err != nil {
		return Config{}, err
	}
	if cfg.DBMaxOpenConns, err = intFromEnv("DB_MAX_OPEN_CONNS", cfg.DBMaxOpenConns); err != nil {
		return Config{}, err
	}
	idleConnDefault := cfg.DBMaxIdleConns
	if cfg.DBMaxOpenConns < idleConnDefault {
		idleConnDefault = cfg.DBMaxOpenConns
	}
	if cfg.DBMaxIdleConns, err = intFromEnv("DB_MAX_IDLE_CONNS", idleConnDefault); err != nil {
		return Config{}, err
	}
	if cfg.DBConnMaxLifetime, err = durationFromEnv("DB_CONN_MAX_LIFETIME", cfg.DBConnMaxLifetime); err != nil {
		return Config{}, err
	}
	if cfg.SessionTTL, err = durationFromEnv("SESSION_TTL", cfg.SessionTTL); err != nil {
		return Config{}, err
	}

	if cfg.Port < 1 || cfg.Port > 65535 {
		return Config{}, fmt.Errorf("PORT must be between 1 and 65535")
	}
	if cfg.DBMaxOpenConns < 1 {
		return Config{}, fmt.Errorf("DB_MAX_OPEN_CONNS must be greater than 0")
	}
	if cfg.DBMaxIdleConns < 0 || cfg.DBMaxIdleConns > cfg.DBMaxOpenConns {
		return Config{}, fmt.Errorf("DB_MAX_IDLE_CONNS must be between 0 and DB_MAX_OPEN_CONNS")
	}
	if cfg.DBConnMaxLifetime <= 0 {
		return Config{}, fmt.Errorf("DB_CONN_MAX_LIFETIME must be greater than 0")
	}
	if cfg.SessionTTL <= 0 {
		return Config{}, fmt.Errorf("SESSION_TTL must be greater than 0")
	}

	return cfg, nil
}

func intFromEnv(key string, fallback int) (int, error) {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback, nil
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return 0, fmt.Errorf("%s must be an integer: %w", key, err)
	}
	return parsed, nil
}

func durationFromEnv(key string, fallback time.Duration) (time.Duration, error) {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback, nil
	}
	parsed, err := time.ParseDuration(value)
	if err != nil {
		return 0, fmt.Errorf("%s must be a valid duration: %w", key, err)
	}
	return parsed, nil
}
