package main

import (
"database/sql"
"log"
"os"
"os/signal"
"syscall"
"time"

"github.com/gin-contrib/cors"
"github.com/gin-gonic/gin"
"github.com/joho/godotenv"
_ "github.com/lib/pq"

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
db, err := sql.Open("postgres", os.Getenv("DATABASE_URL"))
if err != nil {
log.Fatal("Error connecting to database:", err)
}
defer db.Close()

// Test database connection
if err := db.Ping(); err != nil {
log.Fatal("Error pinging database:", err)
}

// Initialize components
handler := handlers.NewHandler(db)
authMiddleware := middleware.NewAuthMiddleware(jwtSecret)

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
r.POST("/api/auth/login", auth.LoginHandler(db))
r.POST("/api/auth/register", auth.RegisterHandler(db))
r.POST("/api/tickets", handler.CreateTicket)
r.GET("/api/solutions", handler.GetSolutions)
r.POST("/api/solutions/search", handler.SearchSolutions)

// Protected routes
protected := r.Group("/api")
protected.Use(authMiddleware.AuthRequired())
{
// User routes
protected.GET("/users", handler.GetUsers)
protected.GET("/users/:id", handler.GetUser)
protected.PATCH("/users/:id", handler.UpdateUser)
protected.DELETE("/users/:id", handler.DeleteUser)

// Ticket routes
protected.GET("/tickets", handler.GetTickets)
protected.GET("/tickets/:id", handler.GetTicket)
protected.PATCH("/tickets/:id", handler.UpdateTicket)
protected.DELETE("/tickets/:id", handler.DeleteTicket)
protected.GET("/tickets/export", handler.ExportTickets)
protected.GET("/tickets/:id/history", handler.GetTicketHistory)

// Task routes
protected.POST("/tasks", handler.CreateTask)
protected.GET("/tasks", handler.GetTasks)
protected.GET("/tasks/:id", handler.GetTask)
protected.PATCH("/tasks/:id", handler.UpdateTask)
protected.DELETE("/tasks/:id", handler.DeleteTask)

// Solution routes
protected.POST("/solutions", handler.CreateSolution)
protected.PATCH("/solutions/:id", handler.UpdateSolution)
protected.DELETE("/solutions/:id", handler.DeleteSolution)
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