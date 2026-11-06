package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadDotenvAndEnvironmentPrecedence(t *testing.T) {
	dir := t.TempDir()
	t.Chdir(dir)
	t.Setenv("PORT", "9090")
	for _, key := range []string{"DATABASE_URL", "QUEVO_CUSTOMER_PASSWORD", "QUEVO_OPERATOR_PASSWORD"} {
		t.Setenv(key, "")
		if err := os.Unsetenv(key); err != nil {
			t.Fatal(err)
		}
	}
	contents := "PORT=8081\nDATABASE_URL=postgres://example/test\nQUEVO_CUSTOMER_PASSWORD=customer secret\nQUEVO_OPERATOR_PASSWORD=operator secret\n"
	if err := os.WriteFile(filepath.Join(dir, ".env"), []byte(contents), 0600); err != nil {
		t.Fatal(err)
	}
	cfg, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Port != 9090 || cfg.DatabaseURL != "postgres://example/test" || cfg.CustomerPassword != "customer secret" || cfg.OperatorPassword != "operator secret" {
		t.Fatal("configuration did not use .env values and environment precedence")
	}
}
