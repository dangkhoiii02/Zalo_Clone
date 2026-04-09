package mongo

import (
	"context"
	"fmt"
	"time"

	"github.com/dangkhoii/zalo-clone/internal/domain"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type messageRepository struct {
	collection *mongo.Collection
}

func NewMessageRepository(db *mongo.Database) *messageRepository {
	return &messageRepository{
		collection: db.Collection("messages"),
	}
}

func (r *messageRepository) Create(ctx context.Context, message *domain.Message) error {
	message.CreatedAt = time.Now()
	message.UpdatedAt = time.Now()
	if message.ReadBy == nil {
		message.ReadBy = []string{message.SenderID}
	}
	if message.Type == "" {
		message.Type = domain.MessageTypeText
	}

	result, err := r.collection.InsertOne(ctx, message)
	if err != nil {
		return fmt.Errorf("failed to insert message: %w", err)
	}

	if oid, ok := result.InsertedID.(bson.ObjectID); ok {
		message.ID = oid.Hex()
	}
	return nil
}

func (r *messageRepository) GetByConversation(ctx context.Context, conversationID string, limit, offset int) ([]*domain.Message, error) {
	filter := bson.M{"conversation_id": conversationID}
	opts := options.Find().
		SetSort(bson.D{{Key: "created_at", Value: -1}}).
		SetLimit(int64(limit)).
		SetSkip(int64(offset))

	cursor, err := r.collection.Find(ctx, filter, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to find messages: %w", err)
	}
	defer cursor.Close(ctx)

	var messages []*domain.Message
	if err := cursor.All(ctx, &messages); err != nil {
		return nil, fmt.Errorf("failed to decode messages: %w", err)
	}
	return messages, nil
}

func (r *messageRepository) MarkAsRead(ctx context.Context, messageID, userID string) error {
	oid, err := bson.ObjectIDFromHex(messageID)
	if err != nil {
		return fmt.Errorf("invalid message ID: %w", err)
	}

	filter := bson.M{"_id": oid}
	update := bson.M{
		"$addToSet": bson.M{"read_by": userID},
		"$set":      bson.M{"updated_at": time.Now()},
	}

	_, err = r.collection.UpdateOne(ctx, filter, update)
	if err != nil {
		return fmt.Errorf("failed to mark message as read: %w", err)
	}
	return nil
}
