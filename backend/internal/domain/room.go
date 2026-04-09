package domain

import "time"

type Room struct {
	Name         string    `json:"name"`
	CallerID     string    `json:"caller_id"`
	CalleeID     string    `json:"callee_id"`
	CallerToken  string    `json:"caller_token,omitempty"`
	CalleeToken  string    `json:"callee_token,omitempty"`
	Status       string    `json:"status"` // "ringing", "active", "ended"
	CreatedAt    time.Time `json:"created_at"`
}

type StartCallRequest struct {
	CalleeID string `json:"callee_id" binding:"required"`
}

type StartCallResponse struct {
	RoomName string `json:"room_name"`
	Token    string `json:"token"`
}

type JoinCallResponse struct {
	RoomName string `json:"room_name"`
	Token    string `json:"token"`
}
