package repository

import (
	"context"

	"github.com/dangkhoii/zalo-clone/internal/domain"
	"github.com/google/uuid"
)

// UserRepository handles user data persistence in PostgreSQL
type UserRepository interface {
	Create(ctx context.Context, user *domain.User) error
	GetByID(ctx context.Context, id uuid.UUID) (*domain.User, error)
	GetByEmail(ctx context.Context, email string) (*domain.User, error)
	GetByUsername(ctx context.Context, username string) (*domain.User, error)
	Update(ctx context.Context, user *domain.User) error
	SearchUsers(ctx context.Context, query string, limit int) ([]*domain.User, error)
}

// FriendshipRepository handles friendship data in PostgreSQL
type FriendshipRepository interface {
	Create(ctx context.Context, friendship *domain.Friendship) error
	GetByID(ctx context.Context, id uuid.UUID) (*domain.Friendship, error)
	UpdateStatus(ctx context.Context, id uuid.UUID, status domain.FriendshipStatus) error
	Delete(ctx context.Context, id uuid.UUID) error
	GetFriends(ctx context.Context, userID uuid.UUID) ([]*domain.FriendInfo, error)
	GetPendingRequests(ctx context.Context, userID uuid.UUID) ([]*domain.FriendInfo, error)
	GetFriendship(ctx context.Context, userID, friendID uuid.UUID) (*domain.Friendship, error)
}

// MessageRepository handles message data in MongoDB
type MessageRepository interface {
	Create(ctx context.Context, message *domain.Message) error
	GetByConversation(ctx context.Context, conversationID string, limit, offset int) ([]*domain.Message, error)
	MarkAsRead(ctx context.Context, messageID, userID string) error
}

// ConversationRepository handles conversation data in MongoDB
type ConversationRepository interface {
	Create(ctx context.Context, conversation *domain.Conversation) error
	GetByID(ctx context.Context, id string) (*domain.Conversation, error)
	GetByParticipants(ctx context.Context, participants []string) (*domain.Conversation, error)
	GetUserConversations(ctx context.Context, userID string) ([]*domain.Conversation, error)
	UpdateLastMessage(ctx context.Context, conversationID string, lastMsg *domain.LastMessage) error
}

// PresenceRepository handles online presence in Redis
type PresenceRepository interface {
	SetOnline(ctx context.Context, userID string) error
	SetOffline(ctx context.Context, userID string) error
	IsOnline(ctx context.Context, userID string) (bool, error)
	GetOnlineUsers(ctx context.Context, userIDs []string) (map[string]bool, error)
	SetTyping(ctx context.Context, userID, conversationID string) error
}
