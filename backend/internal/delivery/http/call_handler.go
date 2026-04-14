package http

import (
	"net/http"

	"github.com/dangkhoii/zalo-clone/internal/delivery/ws"
	"github.com/dangkhoii/zalo-clone/internal/middleware"
	"github.com/dangkhoii/zalo-clone/internal/domain"
	"github.com/dangkhoii/zalo-clone/internal/usecase"
	"github.com/gin-gonic/gin"
)

type CallHandler struct {
	callUsecase *usecase.CallUsecase
	hub         *ws.Hub
}

func NewCallHandler(callUsecase *usecase.CallUsecase, hub *ws.Hub) *CallHandler {
	return &CallHandler{callUsecase: callUsecase, hub: hub}
}

// @Summary Start a call
// @Description Start a new video call
// @Tags Calls
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body domain.StartCallRequest true "Start Call Request"
// @Success 200 {object} domain.StartCallResponse
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /calls/start [post]
func (h *CallHandler) StartCall(c *gin.Context) {
	userID := middleware.GetUserID(c)
	username := middleware.GetUsername(c)

	var req domain.StartCallRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	resp, err := h.callUsecase.StartCall(userID.String(), username, req.CalleeID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Notify callee via WebSocket about the incoming call
	h.hub.SendToUser(req.CalleeID, ws.WSMessage{
		Type: "incoming_call",
		Data: ws.MustMarshal(map[string]interface{}{
			"room_name":   resp.RoomName,
			"caller_id":   userID.String(),
			"caller_name": username,
		}),
	})

	c.JSON(http.StatusOK, resp)
}

// @Summary Join a call
// @Description Join an existing video call
// @Tags Calls
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param roomName path string true "Room Name"
// @Success 200 {object} domain.JoinCallResponse
// @Failure 401 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /calls/join/{roomName} [post]
func (h *CallHandler) JoinCall(c *gin.Context) {
	userID := middleware.GetUserID(c)
	username := middleware.GetUsername(c)
	roomName := c.Param("roomName")

	resp, err := h.callUsecase.JoinCall(roomName, userID.String(), username)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}
