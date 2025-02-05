package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

type Config struct {
	Server   ServerConfig
	Database DatabaseConfig
	JWT      JWTConfig
	SMTP     SMTPConfig
}

type ServerConfig struct {
	Port            int
	AllowedOrigins []string
	TimeoutSeconds int
}

type DatabaseConfig struct {
	Host     string
	Port     int
	User     string
	Password string
	DBName   string
	SSLMode  string
}

type JWTConfig struct {
	Secret        string
	TokenExpiry   time.Duration
	RefreshSecret string
}

type SMTPConfig struct {
	Host     string
	Port     int
	Username string
	Password string
	From     string
}

// LoadConfig loads configuration from environment variables
func LoadConfig() (*Config, error) {
	config := &Config{}

	// Server configuration
	port, err := strconv.Atoi(getEnvOrDefault("PORT", "8080"))
	if err != nil {
		return nil, fmt.Errorf("invalid PORT: %w", err)
	}

	config.Server = ServerConfig{
		Port: port,
		AllowedOrigins: []string{
			getEnvOrDefault("CORS_ORIGIN", "http://localhost:3000"),
		},
		TimeoutSeconds: 30,
	}

	// Database configuration
	dbPort, err := strconv.Atoi(getEnvOrDefault("DB_PORT", "5432"))
	if err != nil {
		return nil, fmt.Errorf("invalid DB_PORT: %w", err)
	}

	config.Database = DatabaseConfig{
		Host:     getEnvOrDefault("DB_HOST", "localhost"),
		Port:     dbPort,
		User:     getEnvOrDefault("DB_USER", "postgres"),
		Password: getEnvOrDefault("DB_PASSWORD", ""),
		DBName:   getEnvOrDefault("DB_NAME", "helpdesk"),
		SSLMode:  getEnvOrDefault("DB_SSLMODE", "disable"),
	}

	// JWT configuration
	config.JWT = JWTConfig{
		Secret:        getEnvOrDefault("JWT_SECRET", "your-secret-key"),
		TokenExpiry:   24 * time.Hour,
		RefreshSecret: getEnvOrDefault("JWT_REFRESH_SECRET", "your-refresh-secret-key"),
	}

	// SMTP configuration
	smtpPort, err := strconv.Atoi(getEnvOrDefault("SMTP_PORT", "587"))
	if err != nil {
		return nil, fmt.Errorf("invalid SMTP_PORT: %w", err)
	}

	config.SMTP = SMTPConfig{
		Host:     getEnvOrDefault("SMTP_HOST", "smtp.gmail.com"),
		Port:     smtpPort,
		Username: getEnvOrDefault("SMTP_USERNAME", ""),
		Password: getEnvOrDefault("SMTP_PASSWORD", ""),
		From:     getEnvOrDefault("SMTP_FROM", "helpdesk@example.com"),
	}

	return config, nil
}

// GetDSN returns the PostgreSQL connection string
func (c *DatabaseConfig) GetDSN() string {
	return fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		c.Host, c.Port, c.User, c.Password, c.DBName, c.SSLMode,
	)
}

// getEnvOrDefault returns the environment variable value or the default if not set
func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// Validate performs basic validation of the configuration
func (c *Config) Validate() error {
	if c.Server.Port <= 0 {
		return fmt.Errorf("invalid server port: %d", c.Server.Port)
	}

	if c.Database.Host == "" {
		return fmt.Errorf("database host is required")
	}

	if c.Database.Port <= 0 {
		return fmt.Errorf("invalid database port: %d", c.Database.Port)
	}

	if c.JWT.Secret == "" {
		return fmt.Errorf("JWT secret is required")
	}

	return nil
}