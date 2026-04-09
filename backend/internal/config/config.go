package config

import (
	"os"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	Server   ServerConfig
	Postgres PostgresConfig
	Mongo    MongoConfig
	Redis    RedisConfig
	JWT      JWTConfig
	LiveKit  LiveKitConfig
}

type ServerConfig struct {
	Host string
	Port string
}

type PostgresConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	DBName   string
}

func (p PostgresConfig) DSN() string {
	return "postgres://" + p.User + ":" + p.Password + "@" + p.Host + ":" + p.Port + "/" + p.DBName + "?sslmode=disable"
}

type MongoConfig struct {
	URI    string
	DBName string
}

type RedisConfig struct {
	Addr string
}

type JWTConfig struct {
	Secret string
	Expiry time.Duration
}

type LiveKitConfig struct {
	Host      string
	APIKey    string
	APISecret string
}

func Load() (*Config, error) {
	// Load .env file (ignore error if not found)
	_ = godotenv.Load("../.env")
	_ = godotenv.Load(".env")

	jwtExpiry, err := time.ParseDuration(getEnv("JWT_EXPIRY", "24h"))
	if err != nil {
		jwtExpiry = 24 * time.Hour
	}

	return &Config{
		Server: ServerConfig{
			Host: getEnv("SERVER_HOST", "0.0.0.0"),
			Port: getEnv("SERVER_PORT", "8080"),
		},
		Postgres: PostgresConfig{
			Host:     getEnv("POSTGRES_HOST", "localhost"),
			Port:     getEnv("POSTGRES_PORT", "5432"),
			User:     getEnv("POSTGRES_USER", "zalouser"),
			Password: getEnv("POSTGRES_PASSWORD", "zalosecret"),
			DBName:   getEnv("POSTGRES_DB", "zalodb"),
		},
		Mongo: MongoConfig{
			URI:    getEnv("MONGO_URI", "mongodb://localhost:27017"),
			DBName: getEnv("MONGO_DB", "zalochat"),
		},
		Redis: RedisConfig{
			Addr: getEnv("REDIS_ADDR", "localhost:6379"),
		},
		JWT: JWTConfig{
			Secret: getEnv("JWT_SECRET", "default-secret-change-me"),
			Expiry: jwtExpiry,
		},
		LiveKit: LiveKitConfig{
			Host:      getEnv("LIVEKIT_HOST", "http://localhost:7880"),
			APIKey:    getEnv("LIVEKIT_API_KEY", "devkey"),
			APISecret: getEnv("LIVEKIT_API_SECRET", "devsecret"),
		},
	}, nil
}

func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}
