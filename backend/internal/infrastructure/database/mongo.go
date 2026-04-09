package database

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/dangkhoii/zalo-clone/internal/config"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

func NewMongoConnection(cfg config.MongoConfig) (*mongo.Database, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	clientOpts := options.Client().ApplyURI(cfg.URI)
	client, err := mongo.Connect(clientOpts)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to MongoDB: %w", err)
	}

	if err := client.Ping(ctx, nil); err != nil {
		return nil, fmt.Errorf("failed to ping MongoDB: %w", err)
	}

	db := client.Database(cfg.DBName)

	// Create indexes
	if err := createMongoIndexes(ctx, db); err != nil {
		return nil, fmt.Errorf("failed to create MongoDB indexes: %w", err)
	}

	log.Println("✅ Connected to MongoDB")
	return db, nil
}

func createMongoIndexes(ctx context.Context, db *mongo.Database) error {
	// Messages collection indexes
	messagesCol := db.Collection("messages")
	_, err := messagesCol.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{
			Keys: bson.D{
				{Key: "conversation_id", Value: 1},
				{Key: "created_at", Value: -1},
			},
		},
		{
			Keys: bson.D{{Key: "sender_id", Value: 1}},
		},
	})
	if err != nil {
		return err
	}

	// Conversations collection indexes
	conversationsCol := db.Collection("conversations")
	_, err = conversationsCol.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{
			Keys: bson.D{{Key: "participants", Value: 1}},
		},
		{
			Keys: bson.D{{Key: "updated_at", Value: -1}},
		},
	})
	if err != nil {
		return err
	}

	log.Println("✅ MongoDB indexes created")
	return nil
}
