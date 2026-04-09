package usecase

import (
	"context"
	"fmt"
	"time"

	"github.com/dangkhoii/zalo-clone/internal/domain"
	"github.com/dangkhoii/zalo-clone/internal/repository"
	"github.com/google/uuid"
)

type UserUsecase struct {
	userRepo repository.UserRepository
}

func NewUserUsecase(userRepo repository.UserRepository) *UserUsecase {
	return &UserUsecase{userRepo: userRepo}
}

func (uc *UserUsecase) GetProfile(ctx context.Context, userID uuid.UUID) (*domain.User, error) {
	user, err := uc.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, ErrUserNotFound
	}
	return user, nil
}

func (uc *UserUsecase) UpdateProfile(ctx context.Context, userID uuid.UUID, req domain.UpdateProfileRequest) (*domain.User, error) {
	user, err := uc.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, ErrUserNotFound
	}

	if req.Username != nil {
		// Check if username is taken
		existing, _ := uc.userRepo.GetByUsername(ctx, *req.Username)
		if existing != nil && existing.ID != userID {
			return nil, fmt.Errorf("username already taken")
		}
		user.Username = *req.Username
	}
	if req.AvatarURL != nil {
		user.AvatarURL = *req.AvatarURL
	}
	if req.Bio != nil {
		user.Bio = *req.Bio
	}
	user.UpdatedAt = time.Now()

	if err := uc.userRepo.Update(ctx, user); err != nil {
		return nil, err
	}
	return user, nil
}

func (uc *UserUsecase) SearchUsers(ctx context.Context, query string) ([]*domain.User, error) {
	if len(query) < 2 {
		return nil, fmt.Errorf("search query must be at least 2 characters")
	}
	return uc.userRepo.SearchUsers(ctx, query, 20)
}
