# Build stage
FROM golang:1.24-alpine AS build

# Set working directory
WORKDIR /app

# Install build dependencies (like git, if needed by private modules)
RUN apk add --no-cache git

# Copy go.mod and go.sum files FIRST to leverage Docker cache
# These define the module root within the container's WORKDIR
COPY backend/go.mod backend/go.sum ./

# Download dependencies based on the go.mod/go.sum files
RUN go mod download

# Copy ONLY the backend source code AFTER downloading dependencies
# The source code will now be at /app/backend/ relative to the module root /app
COPY backend/ ./backend/

# Build the Go application
# Target the main package using the relative path from the WORKDIR (/app)
# Go should find the package at /app/backend/cmd/server
RUN CGO_ENABLED=0 GOOS=linux go build -o /app/helpdesk-api ./backend/cmd/server

# Final stage (minimal runtime image)
FROM alpine:latest

# Set working directory in the final image
WORKDIR /app

# Install runtime dependencies (ca-certificates for HTTPS, tzdata for timezones)
RUN apk --no-cache add ca-certificates tzdata

# Copy ONLY the compiled binary from the build stage
COPY --from=build /app/helpdesk-api .

# Expose the port the Go app listens on (defined in config/main.go)
EXPOSE 8080

# Set the command to run the executable
CMD ["./helpdesk-api"]
