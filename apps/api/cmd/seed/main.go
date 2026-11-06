package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"example.com/quevo/apps/api/internal/platform/config"
	"example.com/quevo/apps/api/internal/platform/database"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("load configuration: %w", err)
	}
	if cfg.DatabaseURL == "" {
		return fmt.Errorf("DATABASE_URL is required")
	}
	customerPassword := cfg.CustomerPassword
	operatorPassword := cfg.OperatorPassword
	if customerPassword == "" || operatorPassword == "" {
		return fmt.Errorf("QUEVO_CUSTOMER_PASSWORD and QUEVO_OPERATOR_PASSWORD are required")
	}
	customerHash, err := bcrypt.GenerateFromPassword([]byte(customerPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hash customer password: %w", err)
	}
	operatorHash, err := bcrypt.GenerateFromPassword([]byte(operatorPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hash operator password: %w", err)
	}
	db, err := database.Open(cfg.DatabaseURL, database.PoolConfig{
		MaxIdleConns: cfg.DBMaxIdleConns, MaxOpenConns: cfg.DBMaxOpenConns, ConnMaxLifetime: cfg.DBConnMaxLifetime,
	})
	if err != nil {
		return fmt.Errorf("open PostgreSQL: %w", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		return fmt.Errorf("get PostgreSQL pool: %w", err)
	}
	defer func() { _ = sqlDB.Close() }()
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	if err := database.SeedDemo(ctx, db, database.SeedCredentials{
		CustomerHash: string(customerHash), OperatorHash: string(operatorHash),
	}); err != nil {
		return err
	}
	fmt.Println("synthetic Quevo demo records seeded")
	return nil
}
