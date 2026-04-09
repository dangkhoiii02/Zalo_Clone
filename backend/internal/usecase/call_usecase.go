package usecase

import (
	"fmt"
	"time"

	"github.com/dangkhoii/zalo-clone/internal/config"
	"github.com/dangkhoii/zalo-clone/internal/domain"
	"github.com/google/uuid"
	"github.com/livekit/protocol/auth"
)

type CallUsecase struct {
	livekitCfg config.LiveKitConfig
}

func NewCallUsecase(livekitCfg config.LiveKitConfig) *CallUsecase {
	return &CallUsecase{livekitCfg: livekitCfg}
}

func (uc *CallUsecase) StartCall(callerID, callerName, calleeID string) (*domain.StartCallResponse, error) {
	roomName := "call-" + uuid.New().String()

	token, err := uc.generateLiveKitToken(roomName, callerID, callerName)
	if err != nil {
		return nil, fmt.Errorf("failed to generate caller token: %w", err)
	}

	return &domain.StartCallResponse{
		RoomName: roomName,
		Token:    token,
	}, nil
}

func (uc *CallUsecase) JoinCall(roomName, userID, userName string) (*domain.JoinCallResponse, error) {
	token, err := uc.generateLiveKitToken(roomName, userID, userName)
	if err != nil {
		return nil, fmt.Errorf("failed to generate callee token: %w", err)
	}

	return &domain.JoinCallResponse{
		RoomName: roomName,
		Token:    token,
	}, nil
}

func (uc *CallUsecase) generateLiveKitToken(roomName, participantID, participantName string) (string, error) {
	at := auth.NewAccessToken(uc.livekitCfg.APIKey, uc.livekitCfg.APISecret)

	grant := &auth.VideoGrant{
		RoomJoin: true,
		Room:     roomName,
	}

	at.SetVideoGrant(grant).
		SetIdentity(participantID).
		SetName(participantName).
		SetValidFor(24 * time.Hour)

	return at.ToJWT()
}
