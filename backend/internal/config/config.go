package config

import (
	"fmt"
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
	Port int
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
	viper.SetDefault("PORT", 8080)
	viper.SetDefault("JWT_EXPIRES", "24h")
	viper.SetDefault("S3_DISABLE_SSL", false)

	viper.AutomaticEnv()

	// Read environment variables
	config := &Config{
		Server: ServerConfig{
			Port: viper.GetInt("PORT"),
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

	// Validate required configuration
	if config.Database.Host == "" || config.Database.User == "" || config.Database.Password == "" || config.Database.Name == "" {
		return nil, fmt.Errorf("missing required database configuration")
	}

	if config.Auth.JWTSecret == "" {
		return nil, fmt.Errorf("missing required JWT secret")
	}

	return config, nil
}
