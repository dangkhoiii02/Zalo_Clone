package http

import (
	"net/http"
	"strconv"

	"github.com/dangkhoii/zalo-clone/internal/middleware"
	"github.com/dangkhoii/zalo-clone/internal/domain"
	"github.com/dangkhoii/zalo-clone/internal/usecase"
	"github.com/gin-gonic/gin"
)

type ConversationHandler struct {
	messageUsecase *usecase.MessageUsecase
}

func NewConversationHandler(messageUsecase *usecase.MessageUsecase) *ConversationHandler {
	return &ConversationHandler{messageUsecase: messageUsecase}
}

// @Summary Create a conversation
// @Description Create a new direct or group conversation
// @Tags Conversations
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body domain.CreateConversationRequest true "Create Conversation Request"
// @Success 201 {object} domain.Conversation
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /conversations [post]
func (h *ConversationHandler) CreateConversation(c *gin.Context) {
	userID := middleware.GetUserID(c)

	var req domain.CreateConversationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	conv, err := h.messageUsecase.CreateConversation(c.Request.Context(), userID.String(), req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, conv)
}

// @Summary Get user conversations
// @Description Get all conversations for the current user
// @Tags Conversations
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {object} map[string]interface{}
// @Failure 401 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /conversations [get]
func (h *ConversationHandler) GetConversations(c *gin.Context) {
	userID := middleware.GetUserID(c)

	conversations, err := h.messageUsecase.GetConversations(c.Request.Context(), userID.String())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"conversations": conversations})
}

// @Summary Get conversation messages
// @Description Get messages for a specific conversation (paginated)
// @Tags Conversations
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "Conversation ID"
// @Param limit query int false "Limit" default(50)
// @Param offset query int false "Offset" default(0)
// @Success 200 {object} map[string]interface{}
// @Failure 401 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /conversations/{id}/messages [get]
func (h *ConversationHandler) GetMessages(c *gin.Context) {
	conversationID := c.Param("id")

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	messages, err := h.messageUsecase.GetMessages(c.Request.Context(), conversationID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"messages": messages})
}
