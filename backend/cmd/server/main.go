package main

import (
"log"
"os"
"os/signal"
"syscall"
"time"

"github.com/gin-contrib/cors"
"github.com/gin-gonic/gin"
"github.com/joho/godotenv"
"gorm.io/driver/postgres"
"gorm.io/gorm"

"helpdesk/internal/auth"
"helpdesk/internal/handlers"
"helpdesk/internal/middleware"
"helpdesk/internal/scheduler"
)

func main() {
// Load environment variables
if err := godotenv.Load(); err != nil {
log.Printf("Warning: .env file not found")
}

// Check required environment variables
jwtSecret := os.Getenv("JWT_SECRET")
if jwtSecret == "" {
log.Fatal("JWT_SECRET environment variable is required")
}

// Database connection
db, err := gorm.Open(postgres.Open(os.Getenv("DATABASE_URL")), &gorm.Config{})
if err != nil {
log.Fatal("Error connecting to database:", err)
}

sqlDB, err := db.DB()
if err != nil {
log.Fatal("Error getting underlying sql.DB:", err)
}

// Set connection pool settings
sqlDB.SetMaxIdleConns(10)
sqlDB.SetMaxOpenConns(100)
sqlDB.SetConnMaxLifetime(time.Hour)

// Test database connection
if err := sqlDB.Ping(); err != nil {
log.Fatal("Error pinging database:", err)
}

// Initialize services
authService := auth.NewAuthService(db, jwtSecret)

// Initialize handlers
authHandler := handlers.NewAuthHandler(authService)
taskHandler := handlers.NewTaskHandler(db)
userHandler := handlers.NewUserHandler(db, authService)

// Initialize middleware
authMiddleware := middleware.AuthMiddleware(jwtSecret)

// Initialize and start task scheduler and cleanup service
taskScheduler := scheduler.NewTaskScheduler(db)
cleanupService := scheduler.NewCleanupService(db)

// Start background services
log.Println("Starting background services...")
taskScheduler.Start()
cleanupService.Start()
log.Println("Background services started successfully")

// Set up Gin router
r := gin.Default()

// CORS configuration
r.Use(cors.New(cors.Config{
AllowOrigins:     []string{"http://localhost:5173", "http://localhost:3000"},
AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
AllowHeaders:     []string{"Origin", "Authorization", "Content-Type"},
ExposeHeaders:    []string{"Content-Length"},
AllowCredentials: true,
MaxAge:          12 * time.Hour,
}))

// Public routes
r.POST("/api/auth/login", authHandler.Login)
r.POST("/api/auth/register", authHandler.Register)

// Protected routes
protected := r.Group("/api")
protected.Use(authMiddleware)
{
// User routes
protected.GET("/users", userHandler.ListUsers)
protected.GET("/users/:id", userHandler.GetUser)
protected.PATCH("/users/:id", userHandler.UpdateUser)
protected.DELETE("/users/:id", userHandler.DeleteUser)

// Task routes
protected.POST("/tasks", taskHandler.CreateTask)
protected.GET("/tasks", taskHandler.ListTasks)
protected.GET("/tasks/:id", taskHandler.GetTask)
protected.PATCH("/tasks/:id", taskHandler.UpdateTask)
protected.DELETE("/tasks/:id", taskHandler.DeleteTask)
protected.GET("/tasks/:id/history", taskHandler.GetTaskHistory)
protected.GET("/tasks/stats", taskHandler.GetTaskStats)
}

// Set up graceful shutdown
signalChan := make(chan os.Signal, 1)
signal.Notify(signalChan, syscall.SIGINT, syscall.SIGTERM)

go func() {
<-signalChan
log.Println("Received shutdown signal")
log.Println("Performing final cleanup before shutdown...")
cleanupService.CleanupOldTasks()
log.Println("Cleanup complete, shutting down...")
os.Exit(0)
}()

// Start server
port := os.Getenv("PORT")
if port == "" {
port = "8080"
}

log.Printf("Server starting on port %s", port)
if err := r.Run(":" + port); err != nil {
log.Fatal("Error starting server:", err)
}
}