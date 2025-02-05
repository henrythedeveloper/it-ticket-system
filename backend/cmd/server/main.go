package main

import (
"log"
"os"

"github.com/gin-gonic/gin"
"github.com/joho/godotenv"
"gorm.io/driver/postgres"
"gorm.io/gorm"

"helpdesk/internal/auth"
"helpdesk/internal/config"
"helpdesk/internal/handlers"
"helpdesk/internal/middleware"
"helpdesk/internal/models"
)

func main() {
// Load environment variables from .env file
if err := godotenv.Load(); err != nil {
log.Println("Warning: .env file not found")
}

// Load configuration
cfg, err := config.LoadConfig()
if err != nil {
log.Fatalf("Failed to load config: %v", err)
}

// Validate configuration
if err := cfg.Validate(); err != nil {
log.Fatalf("Invalid configuration: %v", err)
}

// Connect to database
db, err := gorm.Open(postgres.Open(cfg.Database.GetDSN()), &gorm.Config{})
if err != nil {
log.Fatalf("Failed to connect to database: %v", err)
}

// Auto-migrate database schema
if err := autoMigrate(db); err != nil {
log.Fatalf("Failed to migrate database: %v", err)
}

// Initialize services and handlers
authService := auth.NewService(db, cfg.JWT.Secret, cfg.JWT.TokenExpiry)
authHandler := handlers.NewAuthHandler(authService)
ticketHandler := handlers.NewTicketHandler(db)
taskHandler := handlers.NewTaskHandler(db)
userHandler := handlers.NewUserHandler(db, authService)

// Set up Gin router
router := setupRouter(cfg, authService, authHandler, ticketHandler, taskHandler, userHandler)

// Start server
addr := os.Getenv("PORT")
if addr == "" {
addr = "8080"
}
log.Printf("Server starting on :%s", addr)
if err := router.Run(":" + addr); err != nil {
log.Fatalf("Failed to start server: %v", err)
}
}

func autoMigrate(db *gorm.DB) error {
return db.AutoMigrate(
&models.User{},
&models.Ticket{},
&models.Task{},
)
}

func setupRouter(
cfg *config.Config,
authService *auth.Service,
authHandler *handlers.AuthHandler,
ticketHandler *handlers.TicketHandler,
taskHandler *handlers.TaskHandler,
userHandler *handlers.UserHandler,
) *gin.Engine {
router := gin.Default()

// CORS middleware
router.Use(middleware.CORSMiddleware(cfg.Server.AllowedOrigins))

// Public routes
public := router.Group("/api/v1")
{
// Auth endpoints
public.POST("/auth/login", authHandler.Login)
public.POST("/auth/register", authHandler.Register)

// Ticket submission
public.POST("/tickets", ticketHandler.CreateTicket)
}

// Protected routes
protected := router.Group("/api/v1")
protected.Use(middleware.AuthMiddleware(authService))
{
// Auth endpoints
protected.GET("/auth/verify", authHandler.VerifyToken)
protected.POST("/auth/change-password", authHandler.ChangePassword)

// Tickets management
tickets := protected.Group("/tickets")
{
tickets.GET("", ticketHandler.ListTickets)
tickets.GET("/:id", ticketHandler.GetTicket)
tickets.PATCH("/:id", ticketHandler.UpdateTicket)
tickets.DELETE("/:id", middleware.RequireRole("admin"), ticketHandler.DeleteTicket)
tickets.GET("/stats", ticketHandler.GetTicketStats)
}

// Tasks management
tasks := protected.Group("/tasks")
{
tasks.POST("", taskHandler.CreateTask)
tasks.GET("", taskHandler.ListTasks)
tasks.GET("/:id", taskHandler.GetTask)
tasks.PATCH("/:id", taskHandler.UpdateTask)
tasks.DELETE("/:id", taskHandler.DeleteTask)
tasks.GET("/stats", taskHandler.GetTaskStats)
}

// User management (admin only)
users := protected.Group("/users")
users.Use(middleware.RequireRole("admin"))
{
users.GET("", userHandler.ListUsers)
users.PATCH("/:id", userHandler.UpdateUser)
users.DELETE("/:id", userHandler.DeleteUser)
users.GET("/stats", userHandler.GetUserStats)
}

// User profile
protected.GET("/profile", userHandler.GetUserProfile)
}

return router
}