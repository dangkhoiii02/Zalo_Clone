package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/dangkhoii/zalo-clone/internal/config"
	httpDelivery "github.com/dangkhoii/zalo-clone/internal/delivery/http"
	"github.com/dangkhoii/zalo-clone/internal/delivery/ws"
	"github.com/dangkhoii/zalo-clone/internal/infrastructure/database"
	mongoRepo "github.com/dangkhoii/zalo-clone/internal/repository/mongo"
	pgRepo "github.com/dangkhoii/zalo-clone/internal/repository/postgres"
	redisRepo "github.com/dangkhoii/zalo-clone/internal/repository/redis"
	"github.com/dangkhoii/zalo-clone/internal/usecase"
)

// @title           Zalo Clone API
// @version         1.0
// @description     This is a WhatsApp/FaceTime clone API server.

// @contact.name   API Support

// @host      localhost:8080
// @BasePath  /api/v1

// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
func main() {
	log.Println("🚀 Starting Zalo Clone Server...")

	// Load config
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("❌ Failed to load config: %v", err)
	}

	// Connect to PostgreSQL
	pgPool, err := database.NewPostgresConnection(cfg.Postgres)
	if err != nil {
		log.Fatalf("❌ Failed to connect to PostgreSQL: %v", err)
	}
	defer pgPool.Close()

	// Run migrations
	if err := database.RunMigrations(pgPool); err != nil {
		log.Fatalf("❌ Failed to run migrations: %v", err)
	}

	// Connect to MongoDB
	mongoDB, err := database.NewMongoConnection(cfg.Mongo)
	if err != nil {
		log.Fatalf("❌ Failed to connect to MongoDB: %v", err)
	}

	// Connect to Redis
	redisClient, err := database.NewRedisConnection(cfg.Redis)
	if err != nil {
		log.Fatalf("❌ Failed to connect to Redis: %v", err)
	}
	defer redisClient.Close()

	// Initialize repositories
	userRepo := pgRepo.NewUserRepository(pgPool)
	friendshipRepo := pgRepo.NewFriendshipRepository(pgPool)
	messageRepo := mongoRepo.NewMessageRepository(mongoDB)
	conversationRepo := mongoRepo.NewConversationRepository(mongoDB)
	presenceRepo := redisRepo.NewPresenceRepository(redisClient)

	// Initialize use cases
	authUsecase := usecase.NewAuthUsecase(userRepo, cfg.JWT)
	userUsecase := usecase.NewUserUsecase(userRepo)
	friendshipUsecase := usecase.NewFriendshipUsecase(friendshipRepo, userRepo, presenceRepo)
	_ = usecase.NewMessageUsecase(messageRepo, conversationRepo) // Used by WS Hub
	callUsecase := usecase.NewCallUsecase(cfg.LiveKit)

	// Initialize WebSocket Hub
	hub := ws.NewHub(messageRepo, conversationRepo, presenceRepo)
	go hub.Run()

	// Initialize HTTP handlers
	authHandler := httpDelivery.NewAuthHandler(authUsecase)
	userHandler := httpDelivery.NewUserHandler(userUsecase)
	friendshipHandler := httpDelivery.NewFriendshipHandler(friendshipUsecase)
	callHandler := httpDelivery.NewCallHandler(callUsecase)
	wsHandler := ws.NewHandler(hub, cfg.JWT.Secret)

	// Setup router
	router := httpDelivery.NewRouter(httpDelivery.RouterDeps{
		AuthHandler:       authHandler,
		UserHandler:       userHandler,
		FriendshipHandler: friendshipHandler,
		CallHandler:       callHandler,
		WSHandler:         wsHandler,
		JWTSecret:         cfg.JWT.Secret,
		PgPool:            pgPool,
		MongoDB:           mongoDB,
		RedisClient:       redisClient,
	})

	// Start server
	addr := cfg.Server.Host + ":" + cfg.Server.Port
	srv := &http.Server{
		Addr:         addr,
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful shutdown
	go func() {
		log.Printf("🌐 Server running on http://%s", addr)
		log.Println("📡 WebSocket endpoint: ws://" + addr + "/api/v1/ws")
		log.Println("❤️  Health check: http://" + addr + "/api/v1/health")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("❌ Server error: %v", err)
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("🛑 Shutting down server...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("❌ Server forced to shutdown: %v", err)
	}
	log.Println("✅ Server stopped gracefully")
}
