package domain

import (
	"time"
)

type MessageType string

const (
	MessageTypeText   MessageType = "text"
	MessageTypeImage  MessageType = "image"
	MessageTypeFile   MessageType = "file"
	MessageTypeSystem MessageType = "system"
)

type Message struct {
	ID             string      `json:"id" bson:"_id,omitempty"`
	ConversationID string      `json:"conversation_id" bson:"conversation_id"`
	SenderID       string      `json:"sender_id" bson:"sender_id"`
	Content        string      `json:"content" bson:"content"`
	Type           MessageType `json:"type" bson:"type"`
	MediaURL       string      `json:"media_url,omitempty" bson:"media_url,omitempty"`
	ReadBy         []string    `json:"read_by" bson:"read_by"`
	CreatedAt      time.Time   `json:"created_at" bson:"created_at"`
	UpdatedAt      time.Time   `json:"updated_at" bson:"updated_at"`
}

type ConversationType string

const (
	ConversationDirect ConversationType = "direct"
	ConversationGroup  ConversationType = "group"
)

type LastMessage struct {
	Content   string    `json:"content" bson:"content"`
	SenderID  string    `json:"sender_id" bson:"sender_id"`
	CreatedAt time.Time `json:"created_at" bson:"created_at"`
}

type Conversation struct {
	ID           string           `json:"id" bson:"_id,omitempty"`
	Type         ConversationType `json:"type" bson:"type"`
	Participants []string         `json:"participants" bson:"participants"`
	Name         string           `json:"name,omitempty" bson:"name,omitempty"`
	LastMessage  *LastMessage     `json:"last_message,omitempty" bson:"last_message,omitempty"`
	CreatedAt    time.Time        `json:"created_at" bson:"created_at"`
	UpdatedAt    time.Time        `json:"updated_at" bson:"updated_at"`
}

type SendMessageRequest struct {
	ConversationID string `json:"conversation_id" binding:"required"`
	Content        string `json:"content" binding:"required"`
	Type           string `json:"type"`
	MediaURL       string `json:"media_url,omitempty"`
}

type CreateConversationRequest struct {
	Type         string   `json:"type" binding:"required"`
	Participants []string `json:"participants" binding:"required"`
	Name         string   `json:"name,omitempty"`
}
