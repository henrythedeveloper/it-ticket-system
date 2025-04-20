package config

import (
	"errors"
	"fmt"
	"log/slog" // Import slog for logging config loading
	"os"       // Import os for slog handler
	"time"

	"github.com/spf13/viper"
)

// Config holds all configuration for the application
type Config struct {
	Server   ServerConfig
	Database DatabaseConfig
	Auth     AuthConfig
	Email    EmailConfig
	Storage  StorageConfig
}

// ServerConfig holds server-specific configurations
type ServerConfig struct {
	Port          int
	PortalBaseURL string
}

// DatabaseConfig holds database connection parameters
type DatabaseConfig struct {
	Host     string
	Port     int
	User     string
	Password string
	Name     string
	SSLMode  string
}

// AuthConfig holds authentication settings
type AuthConfig struct {
	JWTSecret  string
	JWTExpires time.Duration
}

// EmailConfig holds email service configuration
type EmailConfig struct {
	Provider string
	APIKey   string
	From     string
}

// StorageConfig holds file storage configuration
type StorageConfig struct {
	Endpoint   string
	Region     string
	Bucket     string
	AccessKey  string
	SecretKey  string
	DisableSSL bool
}

// Load loads configuration from environment variables
func Load() (*Config, error) {
	// Configure slog for logging during loading
	logger := slog.New(slog.NewTextHandler(os.Stderr, nil))

	logger.Info("Loading configuration...")

	// Set defaults
	viper.SetDefault("PORT", 8080)
	viper.SetDefault("JWT_EXPIRES", "24h")
	viper.SetDefault("S3_DISABLE_SSL", false)
	viper.SetDefault("DB_SSL_MODE", "disable") // Example default if often used

	viper.AutomaticEnv() // Read environment variables

	// Read environment variables into the Config struct
	config := &Config{
		Server: ServerConfig{
			Port:          viper.GetInt("PORT"),
			PortalBaseURL: viper.GetString("PORTAL_BASE_URL"),
		},
		Database: DatabaseConfig{
			Host:     viper.GetString("DB_HOST"),
			Port:     viper.GetInt("DB_PORT"),
			User:     viper.GetString("DB_USER"),
			Password: viper.GetString("DB_PASSWORD"),
			Name:     viper.GetString("DB_NAME"),
			SSLMode:  viper.GetString("DB_SSL_MODE"),
		},
		Auth: AuthConfig{
			JWTSecret:  viper.GetString("JWT_SECRET"),
			JWTExpires: viper.GetDuration("JWT_EXPIRES"),
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

	// --- Start Validation ---
	var missingConfig []string

	if config.Server.PortalBaseURL == "" {
		missingConfig = append(missingConfig, "PORTAL_BASE_URL")
	}
	if config.Database.Host == "" {
		missingConfig = append(missingConfig, "DB_HOST")
	}
	if config.Database.User == "" {
		missingConfig = append(missingConfig, "DB_USER")
	}
	if config.Database.Password == "" {
		missingConfig = append(missingConfig, "DB_PASSWORD")
	}
	if config.Database.Name == "" {
		missingConfig = append(missingConfig, "DB_NAME")
	}
	if config.Auth.JWTSecret == "" {
		missingConfig = append(missingConfig, "JWT_SECRET")
	}
	if config.Email.Provider != "" { // Only validate email creds if provider is set
		if config.Email.APIKey == "" {
			missingConfig = append(missingConfig, "EMAIL_API_KEY")
		}
		if config.Email.From == "" {
			missingConfig = append(missingConfig, "EMAIL_FROM")
		}
	}
	if config.Storage.Endpoint != "" { // Only validate storage creds if endpoint is set
		if config.Storage.Bucket == "" {
			missingConfig = append(missingConfig, "S3_BUCKET")
		}
		if config.Storage.AccessKey == "" {
			missingConfig = append(missingConfig, "S3_ACCESS_KEY")
		}
		if config.Storage.SecretKey == "" {
			missingConfig = append(missingConfig, "S3_SECRET_KEY")
		}
	}

	if len(missingConfig) > 0 {
		errMsg := fmt.Sprintf("missing required configuration variables: %v", missingConfig)
		logger.Error(errMsg)
		return nil, errors.New(errMsg)
	}
	// --- End Validation ---

	logger.Info("Configuration loaded successfully.")
	// Log loaded values cautiously - avoid logging secrets!
	logger.Debug("Loaded configuration details",
		slog.Int("port", config.Server.Port),
		slog.String("portalBaseURL", config.Server.PortalBaseURL),
		slog.String("dbHost", config.Database.Host),
		slog.String("dbName", config.Database.Name),
		slog.String("emailProvider", config.Email.Provider),
		slog.String("s3Endpoint", config.Storage.Endpoint),
	)

	return config, nil
}
