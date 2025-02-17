package auth

import (
"errors"
"time"

"github.com/golang-jwt/jwt/v5"
"golang.org/x/crypto/bcrypt"
"gorm.io/gorm"

"helpdesk/internal/models"
)

var (
ErrUserExists          = errors.New("user already exists")
ErrInvalidCredentials = errors.New("invalid credentials")
)

type AuthService struct {
db        *gorm.DB
jwtSecret string
}

func NewAuthService(db *gorm.DB, jwtSecret string) *AuthService {
return &AuthService{
db:        db,
jwtSecret: jwtSecret,
}
}

// HashPassword hashes a plain text password using bcrypt
func HashPassword(password string) (string, error) {
hashedBytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
if err != nil {
return "", err
}
return string(hashedBytes), nil
}

type LoginInput struct {
Email    string `json:"email" binding:"required,email"`
Password string `json:"password" binding:"required"`
}

type RegisterInput struct {
Name     string `json:"name" binding:"required"`
Email    string `json:"email" binding:"required,email"`
Password string `json:"password" binding:"required,min=6"`
Role     string `json:"role" binding:"required,oneof=admin staff"`
}

type AuthResponse struct {
Token string      `json:"token"`
User  models.User `json:"user"`
}

func (s *AuthService) Login(input LoginInput) (*AuthResponse, error) {
var user models.User
if err := s.db.Where("email = ?", input.Email).First(&user).Error; err != nil {
if err == gorm.ErrRecordNotFound {
return nil, ErrInvalidCredentials
}
return nil, err
}

if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(input.Password)); err != nil {
return nil, ErrInvalidCredentials
}

token, err := s.generateToken(user)
if err != nil {
return nil, err
}

return &AuthResponse{
Token: token,
User:  user,
}, nil
}

func (s *AuthService) Register(input RegisterInput) (*AuthResponse, error) {
var existingUser models.User
err := s.db.Where("email = ?", input.Email).First(&existingUser).Error
if err == nil {
return nil, ErrUserExists
}
if err != gorm.ErrRecordNotFound {
return nil, err
}

hashedPassword, err := HashPassword(input.Password)
if err != nil {
return nil, err
}

user := models.User{
Name:     input.Name,
Email:    input.Email,
Password: hashedPassword,
Role:     input.Role,
}

if err := s.db.Create(&user).Error; err != nil {
return nil, err
}

token, err := s.generateToken(user)
if err != nil {
return nil, err
}

return &AuthResponse{
Token: token,
User:  user,
}, nil
}

func (s *AuthService) generateToken(user models.User) (string, error) {
token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
"userID": user.ID,
"email":  user.Email,
"role":   user.Role,
"exp":    time.Now().Add(24 * time.Hour).Unix(),
})

return token.SignedString([]byte(s.jwtSecret))
}

func (s *AuthService) ValidateToken(tokenString string) (*jwt.Token, error) {
return jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
return []byte(s.jwtSecret), nil
})
}
