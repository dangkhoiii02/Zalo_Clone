package mongo

import (
	"context"
	"fmt"
	"sort"
	"time"

	"github.com/dangkhoii/zalo-clone/internal/domain"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type conversationRepository struct {
	collection *mongo.Collection
}

func NewConversationRepository(db *mongo.Database) *conversationRepository {
	return &conversationRepository{
		collection: db.Collection("conversations"),
	}
}

func (r *conversationRepository) Create(ctx context.Context, conversation *domain.Conversation) error {
	conversation.CreatedAt = time.Now()
	conversation.UpdatedAt = time.Now()

	_, err := r.collection.InsertOne(ctx, conversation)
	if err != nil {
		return fmt.Errorf("failed to create conversation: %w", err)
	}
	return nil
}

func (r *conversationRepository) GetByID(ctx context.Context, id string) (*domain.Conversation, error) {
	filter := bson.M{"_id": id}
	conv := &domain.Conversation{}
	err := r.collection.FindOne(ctx, filter).Decode(conv)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get conversation: %w", err)
	}
	return conv, nil
}

func (r *conversationRepository) GetByParticipants(ctx context.Context, participants []string) (*domain.Conversation, error) {
	// Sort participants to ensure consistent lookup
	sorted := make([]string, len(participants))
	copy(sorted, participants)
	sort.Strings(sorted)

	filter := bson.M{
		"type":         "direct",
		"participants": bson.M{"$all": sorted, "$size": len(sorted)},
	}

	conv := &domain.Conversation{}
	err := r.collection.FindOne(ctx, filter).Decode(conv)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to find conversation: %w", err)
	}
	return conv, nil
}

func (r *conversationRepository) GetUserConversations(ctx context.Context, userID string) ([]*domain.Conversation, error) {
	filter := bson.M{"participants": userID}
	opts := options.Find().SetSort(bson.D{{Key: "updated_at", Value: -1}})

	cursor, err := r.collection.Find(ctx, filter, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to find conversations: %w", err)
	}
	defer cursor.Close(ctx)

	var conversations []*domain.Conversation
	if err := cursor.All(ctx, &conversations); err != nil {
		return nil, fmt.Errorf("failed to decode conversations: %w", err)
	}
	return conversations, nil
}

func (r *conversationRepository) UpdateLastMessage(ctx context.Context, conversationID string, lastMsg *domain.LastMessage) error {
	filter := bson.M{"_id": conversationID}
	update := bson.M{
		"$set": bson.M{
			"last_message": lastMsg,
			"updated_at":   time.Now(),
		},
	}

	_, err := r.collection.UpdateOne(ctx, filter, update)
	if err != nil {
		return fmt.Errorf("failed to update last message: %w", err)
	}
	return nil
}
