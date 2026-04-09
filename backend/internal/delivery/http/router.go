package http

import (
	"net/http"
	"runtime"

	"github.com/dangkhoii/zalo-clone/internal/delivery/ws"
	"github.com/dangkhoii/zalo-clone/internal/middleware"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"go.mongodb.org/mongo-driver/v2/mongo"

	_ "github.com/dangkhoii/zalo-clone/docs"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
)

type RouterDeps struct {
	AuthHandler       *AuthHandler
	UserHandler       *UserHandler
	FriendshipHandler *FriendshipHandler
	CallHandler       *CallHandler
	WSHandler         *ws.Handler
	JWTSecret         string
	PgPool            *pgxpool.Pool
	MongoDB           *mongo.Database
	RedisClient       *redis.Client
}

func NewRouter(deps RouterDeps) *gin.Engine {
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery())
	r.Use(middleware.CORSMiddleware())

	// Health check
	r.GET("/api/v1/health", func(c *gin.Context) {
		pgStatus := "up"
		if err := deps.PgPool.Ping(c.Request.Context()); err != nil {
			pgStatus = "down"
		}

		mongoStatus := "up"
		if err := deps.MongoDB.Client().Ping(c.Request.Context(), nil); err != nil {
			mongoStatus = "down"
		}

		redisStatus := "up"
		if err := deps.RedisClient.Ping(c.Request.Context()).Err(); err != nil {
			redisStatus = "down"
		}

		c.JSON(http.StatusOK, gin.H{
			"status": "ok",
			"services": gin.H{
				"postgres": pgStatus,
				"mongodb":  mongoStatus,
				"redis":    redisStatus,
			},
			"go_version":  runtime.Version(),
			"goroutines":  runtime.NumGoroutine(),
		})
	})

	// Public routes (no auth required)
	auth := r.Group("/api/v1/auth")
	{
		auth.POST("/register", deps.AuthHandler.Register)
		auth.POST("/login", deps.AuthHandler.Login)
	}

	// Protected routes
	protected := r.Group("/api/v1")
	protected.Use(middleware.AuthMiddleware(deps.JWTSecret))
	{
		// Auth
		protected.GET("/auth/me", deps.AuthHandler.Me)

		// Users
		protected.PUT("/users/profile", deps.UserHandler.UpdateProfile)
		protected.GET("/users/search", deps.UserHandler.SearchUsers)

		// Friends
		protected.POST("/friends/request", deps.FriendshipHandler.SendRequest)
		protected.PUT("/friends/accept/:id", deps.FriendshipHandler.AcceptRequest)
		protected.DELETE("/friends/:id", deps.FriendshipHandler.RemoveFriend)
		protected.GET("/friends", deps.FriendshipHandler.GetFriends)
		protected.GET("/friends/requests", deps.FriendshipHandler.GetPendingRequests)

		// Calls (LiveKit)
		protected.POST("/calls/start", deps.CallHandler.StartCall)
		protected.POST("/calls/join/:roomName", deps.CallHandler.JoinCall)
	}

	// WebSocket (auth handled inside the handler via query param)
	r.GET("/api/v1/ws", deps.WSHandler.HandleWebSocket)

	// Swagger documentation
	r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	return r
}
