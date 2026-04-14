package ws

import (
	"context"
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/dangkhoii/zalo-clone/internal/domain"
	"github.com/dangkhoii/zalo-clone/internal/repository"
)

// WSMessage is the JSON message format used over WebSocket
type WSMessage struct {
	Type string          `json:"type"`
	Data json.RawMessage `json:"data,omitempty"`
}

// ChatMessage is the data payload for chat messages
type ChatMessage struct {
	ConversationID string `json:"conversation_id"`
	Content        string `json:"content"`
	Type           string `json:"type,omitempty"`
	MediaURL       string `json:"media_url,omitempty"`
}

// TypingMessage is the data payload for typing events
type TypingMessage struct {
	ConversationID string `json:"conversation_id"`
}

// ReadMessage is the data payload for read receipts
type ReadMessage struct {
	ConversationID string `json:"conversation_id"`
	MessageID      string `json:"message_id"`
}

// Hub manages all active WebSocket connections
type Hub struct {
	clients    map[string]*Client // userID -> Client
	mu         sync.RWMutex
	register   chan *Client
	unregister chan *Client

	messageRepo      repository.MessageRepository
	conversationRepo repository.ConversationRepository
	presenceRepo     repository.PresenceRepository
}

func NewHub(
	messageRepo repository.MessageRepository,
	conversationRepo repository.ConversationRepository,
	presenceRepo repository.PresenceRepository,
) *Hub {
	return &Hub{
		clients:          make(map[string]*Client),
		register:         make(chan *Client),
		unregister:       make(chan *Client),
		messageRepo:      messageRepo,
		conversationRepo: conversationRepo,
		presenceRepo:     presenceRepo,
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			// Close existing connection for this user if any
			if existing, ok := h.clients[client.UserID]; ok {
				existing.Close()
			}
			h.clients[client.UserID] = client
			h.mu.Unlock()

			// Set user online in Redis
			ctx := context.Background()
			_ = h.presenceRepo.SetOnline(ctx, client.UserID)

			log.Printf("👤 User %s (%s) connected. Total: %d", client.Username, client.UserID, len(h.clients))

			// Notify friends that user is online
			h.broadcastPresence(client.UserID, "online")

		case client := <-h.unregister:
			h.mu.Lock()
			if existing, ok := h.clients[client.UserID]; ok && existing == client {
				delete(h.clients, client.UserID)
			}
			h.mu.Unlock()

			// Set user offline
			ctx := context.Background()
			_ = h.presenceRepo.SetOffline(ctx, client.UserID)

			log.Printf("👤 User %s (%s) disconnected. Total: %d", client.Username, client.UserID, len(h.clients))

			// Notify friends that user is offline
			h.broadcastPresence(client.UserID, "offline")
		}
	}
}

func (h *Hub) HandleMessage(client *Client, msg WSMessage) {
	switch msg.Type {
	case "message":
		h.handleChatMessage(client, msg.Data)
	case "typing":
		h.handleTyping(client, msg.Data)
	case "read":
		h.handleRead(client, msg.Data)
	case "heartbeat":
		h.handleHeartbeat(client)
	default:
		log.Printf("⚠️ Unknown message type: %s from user %s", msg.Type, client.UserID)
	}
}

func (h *Hub) handleChatMessage(client *Client, data json.RawMessage) {
	var chatMsg ChatMessage
	if err := json.Unmarshal(data, &chatMsg); err != nil {
		log.Printf("❌ Failed to parse chat message: %v", err)
		return
	}

	ctx := context.Background()

	// Get conversation to find recipients
	conv, err := h.conversationRepo.GetByID(ctx, chatMsg.ConversationID)
	if err != nil || conv == nil {
		log.Printf("❌ Conversation not found: %s", chatMsg.ConversationID)
		return
	}

	// Save message to MongoDB
	msgType := domain.MessageType(chatMsg.Type)
	if msgType == "" {
		msgType = domain.MessageTypeText
	}

	message := &domain.Message{
		ConversationID: chatMsg.ConversationID,
		SenderID:       client.UserID,
		Content:        chatMsg.Content,
		Type:           msgType,
		MediaURL:       chatMsg.MediaURL,
		ReadBy:         []string{client.UserID},
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	if err := h.messageRepo.Create(ctx, message); err != nil {
		log.Printf("❌ Failed to save message: %v", err)
		return
	}

	// Update last message in conversation
	lastMsg := &domain.LastMessage{
		Content:   chatMsg.Content,
		SenderID:  client.UserID,
		CreatedAt: time.Now(),
	}
	_ = h.conversationRepo.UpdateLastMessage(ctx, chatMsg.ConversationID, lastMsg)

	// Broadcast to all participants
	outgoing, _ := json.Marshal(WSMessage{
		Type: "message",
		Data: MustMarshal(map[string]interface{}{
			"id":              message.ID,
			"conversation_id": message.ConversationID,
			"sender_id":       message.SenderID,
			"sender_name":     client.Username,
			"content":         message.Content,
			"type":            message.Type,
			"media_url":       message.MediaURL,
			"created_at":      message.CreatedAt,
		}),
	})

	h.mu.RLock()
	for _, participantID := range conv.Participants {
		if recipient, ok := h.clients[participantID]; ok {
			recipient.Send(outgoing)
		}
	}
	h.mu.RUnlock()
}

func (h *Hub) handleTyping(client *Client, data json.RawMessage) {
	var typingMsg TypingMessage
	if err := json.Unmarshal(data, &typingMsg); err != nil {
		return
	}

	ctx := context.Background()
	_ = h.presenceRepo.SetTyping(ctx, client.UserID, typingMsg.ConversationID)

	// Get conversation participants
	conv, err := h.conversationRepo.GetByID(ctx, typingMsg.ConversationID)
	if err != nil || conv == nil {
		return
	}

	outgoing, _ := json.Marshal(WSMessage{
		Type: "typing",
		Data: MustMarshal(map[string]interface{}{
			"conversation_id": typingMsg.ConversationID,
			"user_id":         client.UserID,
			"username":        client.Username,
		}),
	})

	h.mu.RLock()
	for _, participantID := range conv.Participants {
		if participantID == client.UserID {
			continue
		}
		if recipient, ok := h.clients[participantID]; ok {
			recipient.Send(outgoing)
		}
	}
	h.mu.RUnlock()
}

func (h *Hub) handleRead(client *Client, data json.RawMessage) {
	var readMsg ReadMessage
	if err := json.Unmarshal(data, &readMsg); err != nil {
		return
	}

	ctx := context.Background()
	_ = h.messageRepo.MarkAsRead(ctx, readMsg.MessageID, client.UserID)

	// Notify the conversation
	conv, err := h.conversationRepo.GetByID(ctx, readMsg.ConversationID)
	if err != nil || conv == nil {
		return
	}

	outgoing, _ := json.Marshal(WSMessage{
		Type: "read_receipt",
		Data: MustMarshal(map[string]interface{}{
			"conversation_id": readMsg.ConversationID,
			"message_id":      readMsg.MessageID,
			"read_by":         client.UserID,
		}),
	})

	h.mu.RLock()
	for _, participantID := range conv.Participants {
		if participantID == client.UserID {
			continue
		}
		if recipient, ok := h.clients[participantID]; ok {
			recipient.Send(outgoing)
		}
	}
	h.mu.RUnlock()
}

func (h *Hub) handleHeartbeat(client *Client) {
	ctx := context.Background()
	_ = h.presenceRepo.SetOnline(ctx, client.UserID)
}

func (h *Hub) broadcastPresence(userID, status string) {
	outgoing, _ := json.Marshal(WSMessage{
		Type: "presence",
		Data: MustMarshal(map[string]interface{}{
			"user_id": userID,
			"status":  status,
		}),
	})

	h.mu.RLock()
	for id, client := range h.clients {
		if id != userID {
			client.Send(outgoing)
		}
	}
	h.mu.RUnlock()
}

// SendToUser sends a message to a specific user if they're online
func (h *Hub) SendToUser(userID string, msg WSMessage) {
	data, err := json.Marshal(msg)
	if err != nil {
		return
	}

	h.mu.RLock()
	if client, ok := h.clients[userID]; ok {
		client.Send(data)
	}
	h.mu.RUnlock()
}

func MustMarshal(v interface{}) json.RawMessage {
	data, _ := json.Marshal(v)
	return data
}
