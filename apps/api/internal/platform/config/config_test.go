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
	t.Setenv("DATABASE_URL", "")
	if err := os.Unsetenv("DATABASE_URL"); err != nil {
		t.Fatal(err)
	}
	contents := "PORT=8081\nDATABASE_URL=postgres://example/test\n"
	if err := os.WriteFile(filepath.Join(dir, ".env"), []byte(contents), 0600); err != nil {
		t.Fatal(err)
	}
	cfg, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Port != 9090 || cfg.DatabaseURL != "postgres://example/test" {
		t.Fatal("configuration did not use .env values and environment precedence")
	}
}
