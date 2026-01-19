package core

import (
	"time"
)

type User struct {
	ID        string    `json:"-" db:"id"`
	Username  string    `json:"username" db:"username"`
	Password  string    `json:"-" db:"password"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	Email     string    `db:"email" json:"email"`
	FirstName string    `db:"first_name" json:"firstName"`
	LastName  string    `db:"last_name" json:"lastName"`
	AvatarURL string    `db:"avatar_url" json:"avatarUrl"`
}
