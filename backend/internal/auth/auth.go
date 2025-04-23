// backend/internal/auth/auth.go
// ==========================================================================
// Provides services for handling authentication tasks: password hashing/checking
// and JWT generation/validation.
// ==========================================================================

package auth

import (
	"errors"
	"fmt"
	"log/slog" // Use structured logging
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/henrythedeveloper/it-ticket-system/internal/config" // App configuration
	"github.com/henrythedeveloper/it-ticket-system/internal/models" // Data models
	"golang.org/x/crypto/bcrypt"
)

// --- Service Interface ---

// Service defines the contract for authentication operations.
// Implementations handle the specifics of password hashing and token management.
type Service interface {
	// HashPassword generates a secure hash of a given password.
	HashPassword(password string) (string, error)
	// CheckPassword compares a plaintext password against a stored hash.
	CheckPassword(hashedPassword, password string) error
	// GenerateToken creates a new JWT for a given user.
	GenerateToken(user models.User) (models.Token, error)
	// ValidateToken parses and validates a JWT string, returning the claims if valid.
	ValidateToken(tokenString string) (*Claims, error)
}

// --- Service Implementation ---

// AuthService implements the Service interface using bcrypt for hashing
// and standard JWT libraries for token handling.
type AuthService struct {
	config config.AuthConfig // Holds JWT secret and expiration settings
	logger *slog.Logger      // Instance logger
}

// Claims represents the custom data embedded within a JWT.
// It includes standard registered claims and application-specific user details.
type Claims struct {
	UserID               string          `json:"user_id"` // UUID of the user
	Email                string          `json:"email"`   // User's email address
	Role                 models.UserRole `json:"role"`    // User's role (Admin, Staff, etc.)
	jwt.RegisteredClaims                 // Standard JWT claims (ExpiresAt, IssuedAt, Subject, etc.)
}

// --- Constructor ---

// NewService creates and returns a new AuthService instance.
// It requires authentication configuration containing the JWT secret and expiration duration.
//
// Parameters:
//   - cfg: The authentication configuration (config.AuthConfig).
//
// Returns:
//   - Service: An instance of the AuthService satisfying the Service interface.
func NewService(cfg config.AuthConfig) Service {
	// Create a logger specific to the auth service
	logger := slog.With("service", "AuthService")
	logger.Info("Initializing authentication service")
	return &AuthService{
		config: cfg,
		logger: logger,
	}
}

// --- Service Methods ---

// HashPassword generates a bcrypt hash for the given password string.
// Uses the default bcrypt cost factor.
//
// Parameters:
//   - password: The plaintext password to hash.
//
// Returns:
//   - string: The generated bcrypt hash string.
//   - error: An error if hashing fails.
func (s *AuthService) HashPassword(password string) (string, error) {
	hashBytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		s.logger.Error("Failed to generate password hash", "error", err)
		return "", fmt.Errorf("failed to hash password: %w", err)
	}
	s.logger.Debug("Password hashed successfully")
	return string(hashBytes), nil
}

// CheckPassword compares a plaintext password against a stored bcrypt hash.
// Returns nil if the password matches the hash, otherwise returns an error
// (typically bcrypt.ErrMismatchedHashAndPassword).
//
// Parameters:
//   - hashedPassword: The stored bcrypt hash string.
//   - password: The plaintext password to compare.
//
// Returns:
//   - error: Nil on match, or an error (e.g., bcrypt.ErrMismatchedHashAndPassword) on mismatch/error.
func (s *AuthService) CheckPassword(hashedPassword, password string) error {
	err := bcrypt.CompareHashAndPassword([]byte(hashedPassword), []byte(password))
	if err != nil {
		// Log mismatch at debug/warn level, not error, as it's expected during failed logins
		if errors.Is(err, bcrypt.ErrMismatchedHashAndPassword) {
			s.logger.Debug("Password check failed: Mismatch")
		} else {
			s.logger.Error("Error during password comparison", "error", err)
		}
		// Return the original error from bcrypt
		return err
	}
	s.logger.Debug("Password check successful")
	return nil
}

// GenerateToken creates and signs a JWT for the provided user.
// The token includes user ID, email, and role, along with standard expiration claims.
//
// Parameters:
//   - user: The user model (models.User) for whom to generate the token.
//
// Returns:
//   - models.Token: A struct containing the access token string, type ("Bearer"), and expiration time.
//   - error: An error if token generation or signing fails.
func (s *AuthService) GenerateToken(user models.User) (models.Token, error) {
	// Calculate expiration time based on configuration
	expirationTime := time.Now().Add(s.config.JWTExpires)

	// Create the custom claims payload
	claims := &Claims{
		UserID: user.ID,
		Email:  user.Email,
		Role:   user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Subject:   user.ID,       // Use user ID as the subject
			Issuer:    "HelpdeskAPI", // Optional: Identify the issuer
			// Audience: []string{"HelpdeskFrontend"}, // Optional: Specify intended audience
		},
	}

	// Create a new token object with HS256 signing method and the claims
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	// Sign the token using the configured JWT secret
	tokenString, err := token.SignedString([]byte(s.config.JWTSecret))
	if err != nil {
		s.logger.Error("Failed to sign JWT token", "userID", user.ID, "error", err)
		return models.Token{}, fmt.Errorf("failed to sign token: %w", err)
	}

	s.logger.Debug("JWT generated successfully", "userID", user.ID, "expiresAt", expirationTime)
	return models.Token{
		AccessToken: tokenString,
		TokenType:   "Bearer", // Standard token type
		ExpiresAt:   expirationTime,
	}, nil
}

// ValidateToken parses a JWT string, verifies its signature and standard claims (like expiration),
// and returns the custom Claims payload if the token is valid.
//
// Parameters:
//   - tokenString: The JWT string extracted from the request header.
//
// Returns:
//   - *Claims: A pointer to the validated custom claims if the token is valid.
//   - error: An error if parsing, validation, or signature verification fails, or if the token is invalid/expired.
func (s *AuthService) ValidateToken(tokenString string) (*Claims, error) {
	claims := &Claims{}

	// Parse the token string, providing the custom Claims struct and the key function
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		// Validate the signing method (alg) is HMAC as expected
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			err := fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			s.logger.Warn("JWT validation failed: Unexpected signing method", "algorithm", token.Header["alg"])
			return nil, err
		}
		// Return the secret key for verification
		return []byte(s.config.JWTSecret), nil
	})

	// Handle parsing errors (e.g., malformed token, signature mismatch, expired)
	if err != nil {
		// Log specific JWT errors if possible
		if errors.Is(err, jwt.ErrTokenMalformed) {
			s.logger.Warn("JWT validation failed: Malformed token")
		} else if errors.Is(err, jwt.ErrTokenSignatureInvalid) {
			s.logger.Warn("JWT validation failed: Invalid signature")
		} else if errors.Is(err, jwt.ErrTokenExpired) || errors.Is(err, jwt.ErrTokenNotValidYet) {
			s.logger.Warn("JWT validation failed: Token expired or not yet valid")
			// Return a specific error for expiration that middleware might handle differently
			return nil, fmt.Errorf("token has expired or is not yet valid: %w", err)
		} else {
			s.logger.Warn("JWT validation failed: Unknown parsing error", "error", err)
		}
		return nil, fmt.Errorf("token validation failed: %w", err) // Wrap original error
	}

	// Double-check if the token is valid after parsing (though ParseWithClaims usually handles this)
	if !token.Valid {
		s.logger.Warn("JWT validation failed: Token marked as invalid after parsing")
		return nil, errors.New("invalid token")
	}

	// Token is valid, return the extracted claims
	s.logger.Debug("JWT validated successfully", "userID", claims.UserID, "role", claims.Role)
	return claims, nil
}
