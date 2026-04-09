package usecase

import (
	"context"
	"fmt"
	"time"

	"github.com/dangkhoii/zalo-clone/internal/domain"
	"github.com/dangkhoii/zalo-clone/internal/repository"
	"github.com/google/uuid"
)

type MessageUsecase struct {
	messageRepo      repository.MessageRepository
	conversationRepo repository.ConversationRepository
}

func NewMessageUsecase(
	messageRepo repository.MessageRepository,
	conversationRepo repository.ConversationRepository,
) *MessageUsecase {
	return &MessageUsecase{
		messageRepo:      messageRepo,
		conversationRepo: conversationRepo,
	}
}

func (uc *MessageUsecase) SendMessage(ctx context.Context, senderID string, req domain.SendMessageRequest) (*domain.Message, error) {
	// Verify conversation exists and sender is a participant
	conv, err := uc.conversationRepo.GetByID(ctx, req.ConversationID)
	if err != nil {
		return nil, fmt.Errorf("failed to get conversation: %w", err)
	}
	if conv == nil {
		return nil, fmt.Errorf("conversation not found")
	}

	isParticipant := false
	for _, p := range conv.Participants {
		if p == senderID {
			isParticipant = true
			break
		}
	}
	if !isParticipant {
		return nil, fmt.Errorf("user is not a participant in this conversation")
	}

	msgType := domain.MessageType(req.Type)
	if msgType == "" {
		msgType = domain.MessageTypeText
	}

	message := &domain.Message{
		ConversationID: req.ConversationID,
		SenderID:       senderID,
		Content:        req.Content,
		Type:           msgType,
		MediaURL:       req.MediaURL,
		ReadBy:         []string{senderID},
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	if err := uc.messageRepo.Create(ctx, message); err != nil {
		return nil, err
	}

	// Update last message in conversation
	lastMsg := &domain.LastMessage{
		Content:   req.Content,
		SenderID:  senderID,
		CreatedAt: time.Now(),
	}
	_ = uc.conversationRepo.UpdateLastMessage(ctx, req.ConversationID, lastMsg)

	return message, nil
}

func (uc *MessageUsecase) GetMessages(ctx context.Context, conversationID string, limit, offset int) ([]*domain.Message, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	return uc.messageRepo.GetByConversation(ctx, conversationID, limit, offset)
}

func (uc *MessageUsecase) CreateConversation(ctx context.Context, creatorID string, req domain.CreateConversationRequest) (*domain.Conversation, error) {
	// Ensure creator is in participants
	hasCreator := false
	for _, p := range req.Participants {
		if p == creatorID {
			hasCreator = true
			break
		}
	}
	if !hasCreator {
		req.Participants = append(req.Participants, creatorID)
	}

	// For direct chats, check if conversation already exists
	if req.Type == string(domain.ConversationDirect) {
		if len(req.Participants) != 2 {
			return nil, fmt.Errorf("direct conversations must have exactly 2 participants")
		}
		existing, _ := uc.conversationRepo.GetByParticipants(ctx, req.Participants)
		if existing != nil {
			return existing, nil
		}
	}

	conv := &domain.Conversation{
		ID:           uuid.New().String(),
		Type:         domain.ConversationType(req.Type),
		Participants: req.Participants,
		Name:         req.Name,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	if err := uc.conversationRepo.Create(ctx, conv); err != nil {
		return nil, err
	}
	return conv, nil
}

func (uc *MessageUsecase) GetConversations(ctx context.Context, userID string) ([]*domain.Conversation, error) {
	return uc.conversationRepo.GetUserConversations(ctx, userID)
}
