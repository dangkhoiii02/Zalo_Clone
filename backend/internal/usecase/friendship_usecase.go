package usecase

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/dangkhoii/zalo-clone/internal/domain"
	"github.com/dangkhoii/zalo-clone/internal/repository"
	"github.com/google/uuid"
)

var (
	ErrFriendshipExists  = errors.New("friendship already exists")
	ErrFriendshipNotFound = errors.New("friendship not found")
	ErrCannotFriendSelf  = errors.New("cannot send friend request to yourself")
)

type FriendshipUsecase struct {
	friendRepo repository.FriendshipRepository
	userRepo   repository.UserRepository
	presence   repository.PresenceRepository
}

func NewFriendshipUsecase(
	friendRepo repository.FriendshipRepository,
	userRepo repository.UserRepository,
	presence repository.PresenceRepository,
) *FriendshipUsecase {
	return &FriendshipUsecase{
		friendRepo: friendRepo,
		userRepo:   userRepo,
		presence:   presence,
	}
}

func (uc *FriendshipUsecase) SendRequest(ctx context.Context, userID, friendID uuid.UUID) (*domain.Friendship, error) {
	if userID == friendID {
		return nil, ErrCannotFriendSelf
	}

	// Check if friend exists
	friend, err := uc.userRepo.GetByID(ctx, friendID)
	if err != nil || friend == nil {
		return nil, ErrUserNotFound
	}

	// Check existing friendship
	existing, _ := uc.friendRepo.GetFriendship(ctx, userID, friendID)
	if existing != nil {
		return nil, ErrFriendshipExists
	}

	friendship := &domain.Friendship{
		ID:        uuid.New(),
		UserID:    userID,
		FriendID:  friendID,
		Status:    domain.FriendshipPending,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if err := uc.friendRepo.Create(ctx, friendship); err != nil {
		return nil, fmt.Errorf("failed to create friendship: %w", err)
	}
	return friendship, nil
}

func (uc *FriendshipUsecase) AcceptRequest(ctx context.Context, userID uuid.UUID, friendshipID uuid.UUID) error {
	friendship, err := uc.friendRepo.GetByID(ctx, friendshipID)
	if err != nil || friendship == nil {
		return ErrFriendshipNotFound
	}

	// Only the recipient can accept
	if friendship.FriendID != userID {
		return fmt.Errorf("only the request recipient can accept")
	}

	if friendship.Status != domain.FriendshipPending {
		return fmt.Errorf("friendship is not in pending state")
	}

	return uc.friendRepo.UpdateStatus(ctx, friendshipID, domain.FriendshipAccepted)
}

func (uc *FriendshipUsecase) RemoveFriend(ctx context.Context, userID uuid.UUID, friendshipID uuid.UUID) error {
	friendship, err := uc.friendRepo.GetByID(ctx, friendshipID)
	if err != nil || friendship == nil {
		return ErrFriendshipNotFound
	}

	// Only participants can remove
	if friendship.UserID != userID && friendship.FriendID != userID {
		return fmt.Errorf("not authorized to remove this friendship")
	}

	return uc.friendRepo.Delete(ctx, friendshipID)
}

func (uc *FriendshipUsecase) GetFriends(ctx context.Context, userID uuid.UUID) ([]*domain.FriendInfo, error) {
	friends, err := uc.friendRepo.GetFriends(ctx, userID)
	if err != nil {
		return nil, err
	}

	// Enrich with online status
	userIDs := make([]string, len(friends))
	for i, f := range friends {
		userIDs[i] = f.UserID.String()
	}

	onlineMap, err := uc.presence.GetOnlineUsers(ctx, userIDs)
	if err == nil {
		for _, f := range friends {
			f.IsOnline = onlineMap[f.UserID.String()]
		}
	}

	return friends, nil
}

func (uc *FriendshipUsecase) GetPendingRequests(ctx context.Context, userID uuid.UUID) ([]*domain.FriendInfo, error) {
	return uc.friendRepo.GetPendingRequests(ctx, userID)
}
