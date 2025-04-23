// backend/internal/config/config.go
// ==========================================================================
// Handles loading and validation of application configuration from environment
// variables using the Viper library. Defines configuration structures.
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
	Database DatabaseConfig // Database connection details
	Auth     AuthConfig     // Authentication (JWT) settings
	Email    EmailConfig    // Email service configuration
	Storage  StorageConfig  // File storage (S3/MinIO) configuration
}

// ServerConfig holds server-specific configurations.
type ServerConfig struct {
	Port          int    // Port the HTTP server listens on (e.g., 8080)
	PortalBaseURL string // Base URL of the frontend portal (used in emails)
}

// DatabaseConfig holds database connection parameters.
type DatabaseConfig struct {
	Host     string // Database host address
	Port     int    // Database port number
	User     string // Database username
	Password string // Database password
	Name     string // Database name
	SSLMode  string // SSL mode for connection (e.g., "disable", "require")
}

// AuthConfig holds authentication settings.
type AuthConfig struct {
	JWTSecret  string        // Secret key used to sign JWT tokens
	JWTExpires time.Duration // Duration for which JWT tokens are valid
}

// EmailConfig holds email service configuration.
type EmailConfig struct {
	Provider string // Email provider name (e.g., "resend", "smtp")
	APIKey   string // API key for the email provider
	From     string // Default "From" email address for outgoing emails
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

// --- Configuration Loading ---

// Load reads configuration settings from environment variables using Viper,
// sets defaults, validates required fields, and returns the populated Config struct.
//
// Environment Variables Expected:
//   - PORT (optional, default: 8080)
//   - PORTAL_BASE_URL (required)
//   - DB_HOST (required)
//   - DB_PORT (required)
//   - DB_USER (required)
//   - DB_PASSWORD (required)
//   - DB_NAME (required)
//   - DB_SSL_MODE (optional, default: "disable")
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
//
// Returns:
//   - *Config: A pointer to the populated and validated Config struct.
//   - error: An error if loading fails or required variables are missing.
func Load() (*Config, error) {
	logger := slog.With("component", "ConfigLoader")
	logger.Info("Loading application configuration from environment variables...")

	// --- Set Defaults ---
	// Use viper.SetDefault for values that should have a fallback.
	viper.SetDefault("PORT", 8080)
	viper.SetDefault("JWT_EXPIRES", "24h") // Default JWT expiration to 24 hours
	viper.SetDefault("S3_DISABLE_SSL", false)
	viper.SetDefault("DB_SSL_MODE", "disable") // Common default for local development

	// --- Read Environment Variables ---
	// Automatically read environment variables that match or have underscores
	// (e.g., DB_HOST will be read for Database.Host if not explicitly bound).
	viper.AutomaticEnv()
	// Optional: Use viper.BindEnv to explicitly map env vars to config keys if needed.
	// viper.BindEnv("Server.Port", "PORT")

	// --- Populate Config Struct ---
	// Create the config struct and populate it using viper.Get* methods.
	config := &Config{
		Server: ServerConfig{
			Port:          viper.GetInt("PORT"), // Reads PORT env var
			PortalBaseURL: viper.GetString("PORTAL_BASE_URL"),
		},
		Database: DatabaseConfig{
			Host:     viper.GetString("DB_HOST"),
			Port:     viper.GetInt("DB_PORT"), // Ensure DB_PORT is set as a number
			User:     viper.GetString("DB_USER"),
			Password: viper.GetString("DB_PASSWORD"),
			Name:     viper.GetString("DB_NAME"),
			SSLMode:  viper.GetString("DB_SSL_MODE"),
		},
		Auth: AuthConfig{
			JWTSecret:  viper.GetString("JWT_SECRET"),
			JWTExpires: viper.GetDuration("JWT_EXPIRES"), // Parses duration strings (e.g., "1h", "30m")
		},
		Email: EmailConfig{
			Provider: viper.GetString("EMAIL_PROVIDER"),
			APIKey:   viper.GetString("EMAIL_API_KEY"),
			From:     viper.GetString("EMAIL_FROM"),
		},
		Storage: StorageConfig{
			Endpoint:   viper.GetString("S3_ENDPOINT"),
			Region:     viper.GetString("S3_REGION"),
			Bucket:     viper.GetString("S3_BUCKET"),
			AccessKey:  viper.GetString("S3_ACCESS_KEY"),
			SecretKey:  viper.GetString("S3_SECRET_KEY"),
			DisableSSL: viper.GetBool("S3_DISABLE_SSL"),
		},
	}

	// --- Validate Required Fields ---
	// Check for essential configuration values.
	var missingConfig []string
	validateField(config.Server.PortalBaseURL, "PORTAL_BASE_URL", &missingConfig)
	validateField(config.Database.Host, "DB_HOST", &missingConfig)
	// validateField(config.Database.Port, "DB_PORT", &missingConfig) // Ints default to 0, check if > 0 maybe?
	if config.Database.Port <= 0 {
		missingConfig = append(missingConfig, "DB_PORT (must be > 0)")
	}
	validateField(config.Database.User, "DB_USER", &missingConfig)
	validateField(config.Database.Password, "DB_PASSWORD", &missingConfig)
	validateField(config.Database.Name, "DB_NAME", &missingConfig)
	validateField(config.Auth.JWTSecret, "JWT_SECRET", &missingConfig)

	// Conditionally validate Email/Storage settings only if the provider/endpoint is set
	if config.Email.Provider != "" {
		logger.Debug("Email provider specified, validating email config", "provider", config.Email.Provider)
		validateField(config.Email.APIKey, "EMAIL_API_KEY", &missingConfig)
		validateField(config.Email.From, "EMAIL_FROM", &missingConfig)
	} else {
		logger.Info("Email provider not specified, skipping email config validation.")
	}

	if config.Storage.Endpoint != "" {
		logger.Debug("Storage endpoint specified, validating storage config", "endpoint", config.Storage.Endpoint)
		validateField(config.Storage.Region, "S3_REGION", &missingConfig) // Region might be optional depending on provider
		validateField(config.Storage.Bucket, "S3_BUCKET", &missingConfig)
		validateField(config.Storage.AccessKey, "S3_ACCESS_KEY", &missingConfig)
		validateField(config.Storage.SecretKey, "S3_SECRET_KEY", &missingConfig)
	} else {
		logger.Info("Storage endpoint not specified, skipping storage config validation.")
	}

	// If any required fields are missing, return an error
	if len(missingConfig) > 0 {
		errMsg := fmt.Sprintf("missing required configuration variables: %s", strings.Join(missingConfig, ", "))
		logger.Error(errMsg)
		return nil, errors.New(errMsg)
	}

	// --- Log Loaded Configuration (Safely) ---
	logger.Info("Configuration loaded successfully.")
	// Log non-sensitive values at Debug level for verification
	logger.Debug("Loaded configuration details",
		slog.Group("server",
			slog.Int("port", config.Server.Port),
			slog.String("portalBaseURL", config.Server.PortalBaseURL),
		),
		slog.Group("database",
			slog.String("host", config.Database.Host),
			slog.Int("port", config.Database.Port),
			slog.String("user", config.Database.User),
			slog.String("name", config.Database.Name),
			slog.String("sslMode", config.Database.SSLMode),
		),
		slog.Group("auth",
			slog.Duration("jwtExpires", config.Auth.JWTExpires),
			// DO NOT log JWTSecret
		),
		slog.Group("email",
			slog.String("provider", config.Email.Provider),
			slog.String("from", config.Email.From),
			// DO NOT log APIKey
		),
		slog.Group("storage",
			slog.String("endpoint", config.Storage.Endpoint),
			slog.String("region", config.Storage.Region),
			slog.String("bucket", config.Storage.Bucket),
			slog.Bool("disableSSL", config.Storage.DisableSSL),
			// DO NOT log AccessKey or SecretKey
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

