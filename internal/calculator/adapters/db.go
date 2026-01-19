package adapters

import (
	"github.com/jmoiron/sqlx"
	_ "github.com/mattn/go-sqlite3"
	"log"
	"os"
	"path/filepath"
)

func connectSQLite() (*sqlx.DB, error) {
	p := os.Getenv("DB_PATH")
	if p == "" {
		p = "./db/main.db"
	}
	if err := os.MkdirAll(filepath.Dir(p), 0755); err != nil {
		return nil, err
	}
	return sqlx.Connect("sqlite3", p)
}

type CalculatorStore[Item any] struct {
	db *sqlx.DB
}

func NewCalculatorDB[Item any]() *CalculatorStore[Item] {
	db, err := connectSQLite()
	if err != nil {
		log.Fatal(err)
	}

	return &CalculatorStore[Item]{db: db}
}

func (s *CalculatorStore[Item]) Close() {
	s.db.Close()
}

func (s *CalculatorStore[Item]) Insert(item Item) error {
	sql := `
    INSERT INTO calculations (result, symbol, num1, num2)
    VALUES (:result, :symbol, :num1, :num2)
	`
	_, err := s.db.NamedExec(sql, item)
	return err
}

func (s *CalculatorStore[Item]) Get(id, table string) (Item, error) {
	var item Item
	err := s.db.Get(&item, "SELECT * FROM "+table+" WHERE id = ?", id)
	if err != nil {
		return item, err
	}
	return item, nil
}

func (s *CalculatorStore[Item]) GetAll(table string) []Item {
	var items []Item
	err := s.db.Select(&items, "SELECT * FROM "+table+" ORDER BY id DESC")

	if err != nil {
		log.Fatal(err)
	}

	return items
}

func (s *CalculatorStore[Item]) Delete(id, table string) error {
	_, err := s.db.Exec("DELETE FROM "+table+" WHERE id = ?", id)
	return err
}
