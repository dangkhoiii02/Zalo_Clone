package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/dangkhoii/zalo-clone/internal/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type friendshipRepository struct {
	pool *pgxpool.Pool
}

func NewFriendshipRepository(pool *pgxpool.Pool) *friendshipRepository {
	return &friendshipRepository{pool: pool}
}

func (r *friendshipRepository) Create(ctx context.Context, friendship *domain.Friendship) error {
	query := `
		INSERT INTO friendships (id, user_id, friend_id, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6)
	`
	_, err := r.pool.Exec(ctx, query,
		friendship.ID, friendship.UserID, friendship.FriendID,
		friendship.Status, friendship.CreatedAt, friendship.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to create friendship: %w", err)
	}
	return nil
}

func (r *friendshipRepository) GetByID(ctx context.Context, id uuid.UUID) (*domain.Friendship, error) {
	query := `SELECT id, user_id, friend_id, status, created_at, updated_at FROM friendships WHERE id = $1`
	f := &domain.Friendship{}
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&f.ID, &f.UserID, &f.FriendID, &f.Status, &f.CreatedAt, &f.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get friendship: %w", err)
	}
	return f, nil
}

func (r *friendshipRepository) UpdateStatus(ctx context.Context, id uuid.UUID, status domain.FriendshipStatus) error {
	query := `UPDATE friendships SET status = $1, updated_at = $2 WHERE id = $3`
	_, err := r.pool.Exec(ctx, query, status, time.Now(), id)
	if err != nil {
		return fmt.Errorf("failed to update friendship status: %w", err)
	}
	return nil
}

func (r *friendshipRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM friendships WHERE id = $1`
	_, err := r.pool.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to delete friendship: %w", err)
	}
	return nil
}

func (r *friendshipRepository) GetFriends(ctx context.Context, userID uuid.UUID) ([]*domain.FriendInfo, error) {
	query := `
		SELECT f.id, u.id, u.username, u.email, u.avatar_url, u.bio, f.status, f.created_at
		FROM friendships f
		JOIN users u ON (
			(f.user_id = $1 AND f.friend_id = u.id) OR
			(f.friend_id = $1 AND f.user_id = u.id)
		)
		WHERE (f.user_id = $1 OR f.friend_id = $1) AND f.status = 'accepted'
		ORDER BY u.username
	`
	rows, err := r.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get friends: %w", err)
	}
	defer rows.Close()

	var friends []*domain.FriendInfo
	for rows.Next() {
		fi := &domain.FriendInfo{}
		if err := rows.Scan(
			&fi.FriendshipID, &fi.UserID, &fi.Username,
			&fi.Email, &fi.AvatarURL, &fi.Bio, &fi.Status, &fi.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan friend: %w", err)
		}
		friends = append(friends, fi)
	}
	return friends, nil
}

func (r *friendshipRepository) GetPendingRequests(ctx context.Context, userID uuid.UUID) ([]*domain.FriendInfo, error) {
	query := `
		SELECT f.id, u.id, u.username, u.email, u.avatar_url, u.bio, f.status, f.created_at
		FROM friendships f
		JOIN users u ON f.user_id = u.id
		WHERE f.friend_id = $1 AND f.status = 'pending'
		ORDER BY f.created_at DESC
	`
	rows, err := r.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get pending requests: %w", err)
	}
	defer rows.Close()

	var requests []*domain.FriendInfo
	for rows.Next() {
		fi := &domain.FriendInfo{}
		if err := rows.Scan(
			&fi.FriendshipID, &fi.UserID, &fi.Username,
			&fi.Email, &fi.AvatarURL, &fi.Bio, &fi.Status, &fi.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan request: %w", err)
		}
		requests = append(requests, fi)
	}
	return requests, nil
}

func (r *friendshipRepository) GetFriendship(ctx context.Context, userID, friendID uuid.UUID) (*domain.Friendship, error) {
	query := `
		SELECT id, user_id, friend_id, status, created_at, updated_at
		FROM friendships
		WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)
	`
	f := &domain.Friendship{}
	err := r.pool.QueryRow(ctx, query, userID, friendID).Scan(
		&f.ID, &f.UserID, &f.FriendID, &f.Status, &f.CreatedAt, &f.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get friendship: %w", err)
	}
	return f, nil
}
