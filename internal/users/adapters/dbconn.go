package adapters

import (
	"os"

	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/jmoiron/sqlx"
)

// ConnectDB prefers Postgres when DATABASE_URL is set; otherwise falls back to SQLite.
func ConnectDB() (*sqlx.DB, error) {
	if url := os.Getenv("DATABASE_URL"); url != "" {
		return sqlx.Connect("pgx", url)
	}
	return ConnectSQLite()
}
