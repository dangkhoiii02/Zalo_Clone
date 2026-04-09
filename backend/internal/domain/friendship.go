package domain

import (
	"time"

	"github.com/google/uuid"
)

type FriendshipStatus string

const (
	FriendshipPending  FriendshipStatus = "pending"
	FriendshipAccepted FriendshipStatus = "accepted"
	FriendshipBlocked  FriendshipStatus = "blocked"
)

type Friendship struct {
	ID        uuid.UUID        `json:"id"`
	UserID    uuid.UUID        `json:"user_id"`
	FriendID  uuid.UUID        `json:"friend_id"`
	Status    FriendshipStatus `json:"status"`
	CreatedAt time.Time        `json:"created_at"`
	UpdatedAt time.Time        `json:"updated_at"`
}

type FriendRequest struct {
	FriendID uuid.UUID `json:"friend_id" binding:"required"`
}

// FriendInfo is the combined view of a friendship with user details
type FriendInfo struct {
	FriendshipID uuid.UUID        `json:"friendship_id"`
	UserID       uuid.UUID        `json:"user_id"`
	Username     string           `json:"username"`
	Email        string           `json:"email"`
	AvatarURL    string           `json:"avatar_url"`
	Bio          string           `json:"bio"`
	Status       FriendshipStatus `json:"status"`
	IsOnline     bool             `json:"is_online"`
	CreatedAt    time.Time        `json:"created_at"`
}
