package adapters

import (
	"os"
	"path/filepath"

	"github.com/jmoiron/sqlx"
	_ "github.com/mattn/go-sqlite3"
)

func ConnectSQLite() (*sqlx.DB, error) {
	p := os.Getenv("DB_PATH")
	if p == "" {
		p = "./db/main.db"
	}
	if err := os.MkdirAll(filepath.Dir(p), 0755); err != nil {
		return nil, err
	}
	return sqlx.Connect("sqlite3", p)
}
