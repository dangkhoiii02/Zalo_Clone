package http

import (
	"net/http"

	"github.com/dangkhoii/zalo-clone/internal/domain"
	"github.com/dangkhoii/zalo-clone/internal/middleware"
	"github.com/dangkhoii/zalo-clone/internal/usecase"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type FriendshipHandler struct {
	friendUsecase *usecase.FriendshipUsecase
}

func NewFriendshipHandler(friendUsecase *usecase.FriendshipUsecase) *FriendshipHandler {
	return &FriendshipHandler{friendUsecase: friendUsecase}
}

// @Summary Send friend request
// @Description Send a friend request to another user
// @Tags Friendship
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body domain.FriendRequest true "Friend Request"
// @Success 201 {object} domain.Friendship
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Router /friends/request [post]
func (h *FriendshipHandler) SendRequest(c *gin.Context) {
	userID := middleware.GetUserID(c)

	var req domain.FriendRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	friendship, err := h.friendUsecase.SendRequest(c.Request.Context(), userID, req.FriendID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, friendship)
}

// @Summary Accept friend request
// @Description Accept a pending friend request
// @Tags Friendship
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "Friendship ID"
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Router /friends/accept/{id} [put]
func (h *FriendshipHandler) AcceptRequest(c *gin.Context) {
	userID := middleware.GetUserID(c)
	friendshipID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid friendship ID"})
		return
	}

	if err := h.friendUsecase.AcceptRequest(c.Request.Context(), userID, friendshipID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "friend request accepted"})
}

// @Summary Remove friend
// @Description Remove a friend or pending request
// @Tags Friendship
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "Friendship ID"
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Router /friends/{id} [delete]
func (h *FriendshipHandler) RemoveFriend(c *gin.Context) {
	userID := middleware.GetUserID(c)
	friendshipID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid friendship ID"})
		return
	}

	if err := h.friendUsecase.RemoveFriend(c.Request.Context(), userID, friendshipID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "friend removed"})
}

// @Summary Get friends
// @Description Get list of accepted friends
// @Tags Friendship
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {object} map[string]interface{}
// @Failure 401 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /friends [get]
func (h *FriendshipHandler) GetFriends(c *gin.Context) {
	userID := middleware.GetUserID(c)

	friends, err := h.friendUsecase.GetFriends(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"friends": friends})
}

// @Summary Get pending friend requests
// @Description Get list of pending incoming friend requests
// @Tags Friendship
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {object} map[string]interface{}
// @Failure 401 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /friends/requests [get]
func (h *FriendshipHandler) GetPendingRequests(c *gin.Context) {
	userID := middleware.GetUserID(c)

	requests, err := h.friendUsecase.GetPendingRequests(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"requests": requests})
}
