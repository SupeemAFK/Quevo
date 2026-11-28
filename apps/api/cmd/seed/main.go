package main

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"time"

	"example.com/quevo/apps/api/internal/platform/config"
	"example.com/quevo/apps/api/internal/platform/database"
	"golang.org/x/crypto/bcrypt"
	"golang.org/x/term"
)

func main() {
	allowPipedOutput := flag.Bool("allow-piped-output", false, "allow trusted automation to capture generated credentials from stdout")
	flag.Parse()
	if err := run(*allowPipedOutput); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run(allowPipedOutput bool) error {
	if !allowPipedOutput && !term.IsTerminal(int(os.Stdout.Fd())) {
		return fmt.Errorf("run seed in a private terminal or use -allow-piped-output to capture credentials securely")
	}
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("load configuration: %w", err)
	}
	if cfg.DatabaseURL == "" {
		return fmt.Errorf("DATABASE_URL is required")
	}

	customerPassword, operatorPassword := rand.Text(), rand.Text()
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
	created, err := database.SeedDemo(ctx, db, database.SeedCredentials{
		CustomerPasswordHash: string(customerHash), OperatorPasswordHash: string(operatorHash),
	}, func(created database.SeededAccounts) error {
		credentials := make(map[string]string, 2)
		if created.Customer {
			credentials[database.DemoCustomerEmail] = customerPassword
		}
		if created.Operator {
			credentials[database.DemoOperatorEmail] = operatorPassword
		}
		if err := json.NewEncoder(os.Stdout).Encode(credentials); err != nil {
			return fmt.Errorf("write generated credentials: %w", err)
		}
		return nil
	})
	if err != nil {
		return err
	}
	if !created.Customer && !created.Operator {
		fmt.Fprintln(os.Stderr, "Demo data seeded. Existing demo passwords are unchanged.")
	}
	return nil
}
