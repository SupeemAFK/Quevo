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
	credentialsPath := flag.String("credentials-file", "", "write new login credentials to a new private JSON file")
	flag.Parse()
	if err := run(*credentialsPath); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run(credentialsPath string) error {
	if credentialsPath == "" && !term.IsTerminal(int(os.Stdout.Fd())) {
		return fmt.Errorf("run seed in a private terminal or pass -credentials-file with a new private file path")
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

	output := os.Stdout
	if credentialsPath != "" {
		output, err = os.OpenFile(credentialsPath, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
		if err != nil {
			return fmt.Errorf("create credentials file: %w", err)
		}
		defer func() { _ = output.Close() }()
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	created, err := database.SeedDemo(ctx, db, database.SeedCredentials{
		CustomerPasswordHash: string(customerHash), OperatorPasswordHash: string(operatorHash),
	})
	if err != nil {
		if credentialsPath != "" {
			_ = output.Close()
			_ = os.Remove(credentialsPath)
		}
		return err
	}
	if !created.Customer && !created.Operator {
		if credentialsPath != "" {
			_ = output.Close()
			if err := os.Remove(credentialsPath); err != nil {
				return fmt.Errorf("remove empty credentials file: %w", err)
			}
		}
		fmt.Fprintln(os.Stderr, "Demo data seeded. Existing demo passwords are unchanged.")
		return nil
	}
	credentials := make(map[string]string, 2)
	if created.Customer {
		credentials[database.DemoCustomerEmail] = customerPassword
	}
	if created.Operator {
		credentials[database.DemoOperatorEmail] = operatorPassword
	}
	if err := json.NewEncoder(output).Encode(credentials); err != nil {
		return fmt.Errorf("demo accounts were created but writing their credentials failed: %w", err)
	}
	if credentialsPath != "" {
		if err := output.Close(); err != nil {
			return fmt.Errorf("close credentials file: %w", err)
		}
	}
	return nil
}
