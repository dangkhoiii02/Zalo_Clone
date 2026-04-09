package redis

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

type presenceRepository struct {
	client *redis.Client
}

func NewPresenceRepository(client *redis.Client) *presenceRepository {
	return &presenceRepository{client: client}
}

const (
	presenceKeyPrefix = "user:presence:"
	typingKeyPrefix   = "user:typing:"
	presenceTTL       = 60 * time.Second
	typingTTL         = 5 * time.Second
)

func (r *presenceRepository) SetOnline(ctx context.Context, userID string) error {
	key := presenceKeyPrefix + userID
	if err := r.client.Set(ctx, key, "online", presenceTTL).Err(); err != nil {
		return fmt.Errorf("failed to set online: %w", err)
	}
	return nil
}

func (r *presenceRepository) SetOffline(ctx context.Context, userID string) error {
	key := presenceKeyPrefix + userID
	if err := r.client.Del(ctx, key).Err(); err != nil {
		return fmt.Errorf("failed to set offline: %w", err)
	}
	return nil
}

func (r *presenceRepository) IsOnline(ctx context.Context, userID string) (bool, error) {
	key := presenceKeyPrefix + userID
	result, err := r.client.Exists(ctx, key).Result()
	if err != nil {
		return false, fmt.Errorf("failed to check online: %w", err)
	}
	return result > 0, nil
}

func (r *presenceRepository) GetOnlineUsers(ctx context.Context, userIDs []string) (map[string]bool, error) {
	onlineMap := make(map[string]bool)
	if len(userIDs) == 0 {
		return onlineMap, nil
	}

	pipe := r.client.Pipeline()
	cmds := make(map[string]*redis.IntCmd)
	for _, uid := range userIDs {
		key := presenceKeyPrefix + uid
		cmds[uid] = pipe.Exists(ctx, key)
	}
	_, err := pipe.Exec(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to check online users: %w", err)
	}

	for uid, cmd := range cmds {
		onlineMap[uid] = cmd.Val() > 0
	}
	return onlineMap, nil
}

func (r *presenceRepository) SetTyping(ctx context.Context, userID, conversationID string) error {
	key := typingKeyPrefix + conversationID + ":" + userID
	if err := r.client.Set(ctx, key, "typing", typingTTL).Err(); err != nil {
		return fmt.Errorf("failed to set typing: %w", err)
	}
	return nil
}
