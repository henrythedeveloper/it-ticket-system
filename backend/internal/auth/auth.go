package auth

import (
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/henrythedeveloper/bus-it-ticket/internal/config"
	"github.com/henrythedeveloper/bus-it-ticket/internal/models"
	"golang.org/x/crypto/bcrypt"
)

// Service defines the authentication service interface
type Service interface {
	HashPassword(password string) (string, error)
	CheckPassword(hashedPassword, password string) error
	GenerateToken(user models.User) (models.Token, error)
	ValidateToken(tokenString string) (*Claims, error)
}

// AuthService is an implementation of the authentication Service
type AuthService struct {
	config config.AuthConfig
}

// Claims represents JWT claims
type Claims struct {
	UserID string          `json:"user_id"`
	Email  string          `json:"email"`
	Role   models.UserRole `json:"role"`
	jwt.RegisteredClaims
}

// NewService creates a new authentication service
func NewService(cfg config.AuthConfig) Service {
	return &AuthService{
		config: cfg,
	}
}

// HashPassword hashes a password using bcrypt
func (s *AuthService) HashPassword(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", fmt.Errorf("failed to hash password: %w", err)
	}
	return string(hash), nil
}

// CheckPassword compares a hashed password with a plain password
func (s *AuthService) CheckPassword(hashedPassword, password string) error {
	return bcrypt.CompareHashAndPassword([]byte(hashedPassword), []byte(password))
}

// GenerateToken generates a JWT token for a user
func (s *AuthService) GenerateToken(user models.User) (models.Token, error) {
	expirationTime := time.Now().Add(s.config.JWTExpires)

	claims := &Claims{
		UserID: user.ID,
		Email:  user.Email,
		Role:   user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Subject:   user.ID,
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(s.config.JWTSecret))
	if err != nil {
		return models.Token{}, fmt.Errorf("failed to sign token: %w", err)
	}

	return models.Token{
		AccessToken: tokenString,
		TokenType:   "Bearer",
		ExpiresAt:   expirationTime,
	}, nil
}

// ValidateToken validates a JWT token
func (s *AuthService) ValidateToken(tokenString string) (*Claims, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(s.config.JWTSecret), nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to parse token: %w", err)
	}

	if !token.Valid {
		return nil, errors.New("invalid token")
	}

	return claims, nil
}
