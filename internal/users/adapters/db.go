package adapters

import (
	"github.com/jmoiron/sqlx"
	_ "github.com/mattn/go-sqlite3"
	"log"
)

type UsersStore[Item any] struct {
	db *sqlx.DB
}

func NewDB[Item any]() *UsersStore[Item] {
	db, err := ConnectDB()
	if err != nil {
		log.Fatal(err)
	}

	return &UsersStore[Item]{db: db}
}

func (s *UsersStore[Item]) Close() {
	s.db.Close()
}

func (s *UsersStore[Item]) Insert(item Item) error {
	sql := `INSERT INTO users (username, password) VALUES (:username, :password) RETURNING id`
	_, err := s.db.NamedExec(sql, item)
	return err
}

func (s *UsersStore[Item]) Get(id, table string) (Item, error) {
	var item Item
	err := s.db.Get(&item, "SELECT * FROM "+table+" WHERE id = ?", id)
	if err != nil {
		return item, err
	}
	return item, nil
}

func (s *UsersStore[Item]) GetAll(table string) []Item {
	var items []Item
	err := s.db.Select(&items, "SELECT * FROM "+table+" ORDER BY id DESC")

	if err != nil {
		log.Fatal(err)
	}

	return items
}

func (s *UsersStore[Item]) Delete(id, table string) error {
	_, err := s.db.Exec("DELETE FROM "+table+" WHERE id = ?", id)
	return err
}

func (s *UsersStore[Item]) DeleteByField(field, value, table string) error {
	_, err := s.db.Exec("DELETE FROM "+table+" WHERE "+field+" = ?", value)

	return err
}

func (s *UsersStore[Item]) GetByField(field, value, table string) (Item, error) {
	var item Item
	err := s.db.Get(&item, "SELECT * FROM "+table+" WHERE "+field+" = ?", value)

	if err != nil {
		return item, err
	}
	return item, nil
}

func (s *UsersStore[Item]) GetSQL(query string, item Item) (Item, error) {
	err := s.db.Get(&item, query)
	if err != nil {
		return item, err
	}
	return item, nil
}
