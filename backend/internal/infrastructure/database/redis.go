package database

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/dangkhoii/zalo-clone/internal/config"
	"github.com/redis/go-redis/v9"
)

func NewRedisConnection(cfg config.RedisConfig) (*redis.Client, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	client := redis.NewClient(&redis.Options{
		Addr:         cfg.Addr,
		DB:           0,
		PoolSize:     20,
		MinIdleConns: 5,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
	})

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to ping Redis: %w", err)
	}

	log.Println("✅ Connected to Redis")
	return client, nil
}
