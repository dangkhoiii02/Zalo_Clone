package database

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/dangkhoii/zalo-clone/internal/config"
	"github.com/jackc/pgx/v5/pgxpool"
)

func NewPostgresConnection(cfg config.PostgresConfig) (*pgxpool.Pool, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	poolConfig, err := pgxpool.ParseConfig(cfg.DSN())
	if err != nil {
		return nil, fmt.Errorf("failed to parse postgres config: %w", err)
	}

	poolConfig.MaxConns = 20
	poolConfig.MinConns = 5
	poolConfig.MaxConnLifetime = 30 * time.Minute
	poolConfig.MaxConnIdleTime = 5 * time.Minute

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create postgres pool: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("failed to ping postgres: %w", err)
	}

	log.Println("✅ Connected to PostgreSQL")
	return pool, nil
}

func RunMigrations(pool *pgxpool.Pool) error {
	ctx := context.Background()

	migrations := []string{
		`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`,
		`CREATE TABLE IF NOT EXISTS users (
			id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			username    VARCHAR(50) UNIQUE NOT NULL,
			email       VARCHAR(255) UNIQUE NOT NULL,
			password    VARCHAR(255) NOT NULL,
			avatar_url  TEXT DEFAULT '',
			bio         TEXT DEFAULT '',
			created_at  TIMESTAMPTZ DEFAULT NOW(),
			updated_at  TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`,
		`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
		`CREATE TABLE IF NOT EXISTS friendships (
			id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			friend_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			status      VARCHAR(20) NOT NULL DEFAULT 'pending',
			created_at  TIMESTAMPTZ DEFAULT NOW(),
			updated_at  TIMESTAMPTZ DEFAULT NOW(),
			UNIQUE(user_id, friend_id)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_friendships_user ON friendships(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_friendships_friend ON friendships(friend_id)`,
	}

	for _, m := range migrations {
		if _, err := pool.Exec(ctx, m); err != nil {
			return fmt.Errorf("migration failed: %w\nSQL: %s", err, m)
		}
	}

	log.Println("✅ PostgreSQL migrations completed")
	return nil
}
