// backend/internal/config/config.go
// ==========================================================================
// Handles loading and validation of application configuration from environment
// variables using the Viper library. Defines configuration structures.
// **REVISED**: Changed DatabaseConfig to use a single DatabaseURL instead of individual fields.
// ==========================================================================

package config

import (
	"errors"
	"fmt"
	"log/slog" // Use structured logging
	"strings"
	"time"

	"github.com/spf13/viper"
)

// --- Configuration Structs ---

// Config aggregates all configuration sections for the application.
type Config struct {
	Server   ServerConfig   // Server-related settings
	Database DatabaseConfig // Database connection details (now uses URL)
	Auth     AuthConfig     // Authentication (JWT) settings
	Email    EmailConfig    // Email service configuration
	Storage  StorageConfig  // File storage (S3/MinIO) configuration
	Cache    CacheConfig    // Caching configuration
}

// ServerConfig holds server-specific configurations.
type ServerConfig struct {
	Port          int    // Port the HTTP server listens on (e.g., 8080)
	PortalBaseURL string // Base URL of the frontend portal (used in emails)
}

// DatabaseConfig now holds the single connection URL.
type DatabaseConfig struct {
	URL string // Database connection URL (e.g., "postgres://user:pass@host:port/db?sslmode=...")
}

// AuthConfig holds authentication settings.
type AuthConfig struct {
	JWTSecret  string        // Secret key used to sign JWT tokens
	JWTExpires time.Duration // Duration for which JWT tokens are valid
}

// EmailConfig holds email service configuration.
type EmailConfig struct {
	From         string `mapstructure:"from"`
	SMTPHost     string `mapstructure:"smtp_host"`
	SMTPPort     int    `mapstructure:"smtp_port"`
	SMTPUser     string `mapstructure:"smtp_user"`     // Optional
	SMTPPassword string `mapstructure:"smtp_password"` // Optional
}

// StorageConfig holds file storage configuration (S3/MinIO).
type StorageConfig struct {
	Endpoint   string // S3 endpoint URL (e.g., MinIO address or AWS S3 endpoint)
	Region     string // S3 region (e.g., "us-east-1")
	Bucket     string // S3 bucket name
	AccessKey  string // S3 access key ID
	SecretKey  string // S3 secret access key
	DisableSSL bool   // Whether to disable SSL for the S3 connection (for MinIO local dev)
}

// CacheConfig holds cache configuration.
type CacheConfig struct {
	Enabled           bool          // Whether caching is enabled
	Provider          string        // Cache provider (e.g., "memory", "redis")
	RedisURL          string        // Redis connection URL
	DefaultExpiration time.Duration // Default expiration time for cache entries
}

// --- Configuration Loading ---

// Load reads configuration settings from environment variables using Viper,
// sets defaults, validates required fields, and returns the populated Config struct.
//
// Environment Variables Expected:
//   - PORT (optional, default: 8080)
//   - PORTAL_BASE_URL (required)
//   - DATABASE_URL (required)  <-- Changed
//   - JWT_SECRET (required)
//   - JWT_EXPIRES (optional, default: "24h")
//   - EMAIL_PROVIDER (optional, e.g., "resend")
//   - EMAIL_API_KEY (required if EMAIL_PROVIDER is set)
//   - EMAIL_FROM (required if EMAIL_PROVIDER is set)
//   - S3_ENDPOINT (optional, e.g., "http://localhost:9000")
//   - S3_REGION (required if S3_ENDPOINT is set)
//   - S3_BUCKET (required if S3_ENDPOINT is set)
//   - S3_ACCESS_KEY (required if S3_ENDPOINT is set)
//   - S3_SECRET_KEY (required if S3_ENDPOINT is set)
//   - S3_DISABLE_SSL (optional, default: false)
//   - CACHE_ENABLED (optional, default: true)
//   - CACHE_PROVIDER (optional, default: "memory")
//   - REDIS_URL (required if CACHE_PROVIDER is "redis")
//   - CACHE_DEFAULT_EXPIRATION (optional, default: "5m")
//
// Returns:
//   - *Config: A pointer to the populated and validated Config struct.
//   - error: An error if loading fails or required variables are missing.
func Load() (*Config, error) {
	logger := slog.With("component", "ConfigLoader")
	logger.Info("Loading application configuration from environment variables...")

	// --- Set Defaults ---
	viper.SetDefault("PORT", 8080)
	viper.SetDefault("JWT_EXPIRES", "24h")
	viper.SetDefault("S3_DISABLE_SSL", false)
	viper.SetDefault("EMAIL_PROVIDER", "smtp")
	viper.SetDefault("SMTP_HOST", "localhost") // Default for local dev (e.g., MailDev)
	viper.SetDefault("SMTP_PORT", 1025)
	viper.SetDefault("CACHE_ENABLED", true)
	viper.SetDefault("CACHE_PROVIDER", "memory")
	viper.SetDefault("CACHE_DEFAULT_EXPIRATION", "5m")

	// --- Read Environment Variables ---
	viper.AutomaticEnv()
	// Explicitly bind DATABASE_URL to ensure it's read correctly
	viper.BindEnv("DATABASE_URL")

	// --- Populate Config Struct ---
	config := &Config{
		Server: ServerConfig{
			Port:          viper.GetInt("PORT"),
			PortalBaseURL: viper.GetString("PORTAL_BASE_URL"),
		},
		Database: DatabaseConfig{
			URL: viper.GetString("DATABASE_URL"), // Read the DATABASE_URL env var
		},
		Auth: AuthConfig{
			JWTSecret:  viper.GetString("JWT_SECRET"),
			JWTExpires: viper.GetDuration("JWT_EXPIRES"),
		},
		Email: EmailConfig{
			From:         viper.GetString("EMAIL_FROM"),
			SMTPHost:     viper.GetString("SMTP_HOST"),
			SMTPPort:     viper.GetInt("SMTP_PORT"),
			SMTPUser:     viper.GetString("SMTP_USER"),
			SMTPPassword: viper.GetString("SMTP_PASSWORD"),
		},
		Storage: StorageConfig{
			Endpoint:   viper.GetString("S3_ENDPOINT"),
			Region:     viper.GetString("S3_REGION"),
			Bucket:     viper.GetString("S3_BUCKET"),
			AccessKey:  viper.GetString("S3_ACCESS_KEY"),
			SecretKey:  viper.GetString("S3_SECRET_KEY"),
			DisableSSL: viper.GetBool("S3_DISABLE_SSL"),
		},
		Cache: CacheConfig{
			Enabled:           viper.GetBool("CACHE_ENABLED"),
			Provider:          viper.GetString("CACHE_PROVIDER"),
			RedisURL:          viper.GetString("REDIS_URL"),
			DefaultExpiration: viper.GetDuration("CACHE_DEFAULT_EXPIRATION"),
		},
	}

	// --- Validate Required Fields ---
	var missingConfig []string
	validateField(config.Server.PortalBaseURL, "PORTAL_BASE_URL", &missingConfig)
	validateField(config.Database.URL, "DATABASE_URL", &missingConfig) // Validate DATABASE_URL
	validateField(config.Auth.JWTSecret, "JWT_SECRET", &missingConfig)
	validateField(config.Email.From, "EMAIL_FROM", &missingConfig)
	validateField(config.Email.SMTPHost, "SMTP_HOST", &missingConfig)
	if config.Email.SMTPPort <= 0 {
		missingConfig = append(missingConfig, "SMTP_PORT (must be > 0)")
	}

	// Storage validation (only if endpoint is set)
	if config.Storage.Endpoint != "" {
		logger.Debug("Storage endpoint specified, validating storage config", "endpoint", config.Storage.Endpoint)
		validateField(config.Storage.Region, "S3_REGION", &missingConfig)
		validateField(config.Storage.Bucket, "S3_BUCKET", &missingConfig)
		validateField(config.Storage.AccessKey, "S3_ACCESS_KEY", &missingConfig)
		validateField(config.Storage.SecretKey, "S3_SECRET_KEY", &missingConfig)
	} else {
		logger.Info("Storage endpoint not specified, skipping storage config validation.")
	}

	// Cache validation (only if provider is redis)
	if config.Cache.Provider == "redis" {
		validateField(config.Cache.RedisURL, "REDIS_URL", &missingConfig)
	}

	// If any required fields are missing, return an error
	if len(missingConfig) > 0 {
		errMsg := fmt.Sprintf("missing required configuration variables: %s", strings.Join(missingConfig, ", "))
		logger.Error(errMsg)
		return nil, errors.New(errMsg)
	}

	// --- Log Loaded Configuration (Safely) ---
	logger.Info("Configuration loaded successfully.")
	logger.Debug("Loaded configuration details",
		slog.Group("server",
			slog.Int("port", config.Server.Port),
			slog.String("portalBaseURL", config.Server.PortalBaseURL),
		),
		slog.Group("database",
			// DO NOT log the full Database.URL as it contains the password
			slog.Bool("url_set", config.Database.URL != ""),
		),
		slog.Group("auth",
			slog.Duration("jwtExpires", config.Auth.JWTExpires),
			// DO NOT log JWTSecret
		),
		slog.Group("email (SMTP)",
			slog.String("from", config.Email.From),
			slog.String("smtp_host", config.Email.SMTPHost),
			slog.Int("smtp_port", config.Email.SMTPPort),
			slog.Bool("smtp_user_set", config.Email.SMTPUser != ""),
		),
		slog.Group("storage",
			slog.String("endpoint", config.Storage.Endpoint),
			slog.String("region", config.Storage.Region),
			slog.String("bucket", config.Storage.Bucket),
			slog.Bool("disableSSL", config.Storage.DisableSSL),
			// DO NOT log AccessKey or SecretKey
		),
		slog.Group("cache",
			slog.Bool("enabled", config.Cache.Enabled),
			slog.String("provider", config.Cache.Provider),
			slog.String("redisURL", config.Cache.RedisURL),
			slog.Duration("defaultExpiration", config.Cache.DefaultExpiration),
		),
	)

	return config, nil
}

// --- Validation Helper ---

// validateField checks if a string configuration field is empty and adds its name
// to the missingConfig slice if it is.
func validateField(value string, name string, missingConfig *[]string) {
	if strings.TrimSpace(value) == "" {
		*missingConfig = append(*missingConfig, name)
	}
}
