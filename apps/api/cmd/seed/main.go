package main

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"time"

	"example.com/quevo/apps/api/internal/platform/database"
	_ "github.com/jackc/pgx/v5/stdlib"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run() error {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		return fmt.Errorf("DATABASE_URL is required")
	}
	customerPassword := os.Getenv("QUEVO_CUSTOMER_PASSWORD")
	operatorPassword := os.Getenv("QUEVO_OPERATOR_PASSWORD")
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
	db, err := sql.Open("pgx", databaseURL)
	if err != nil {
		return fmt.Errorf("open PostgreSQL: %w", err)
	}
	defer func() { _ = db.Close() }()
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
