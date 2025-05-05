# Build stage
# --- Specify exact Go version matching go.mod ---
FROM golang:1.24.2-alpine AS build

# Set initial working directory
WORKDIR /app

# Install build dependencies (like git, if needed by private modules)
RUN apk add --no-cache git

# Copy go.mod and go.sum files FIRST to leverage Docker cache
COPY backend/go.mod backend/go.sum ./

# Download dependencies based on the go.mod/go.sum files
RUN go mod download

# Copy ONLY the backend source code AFTER downloading dependencies
COPY backend/ ./backend/

# Set WORKDIR to the backend directory
WORKDIR /app/backend

# Build the Go application
RUN CGO_ENABLED=0 GOOS=linux go build -v -o /app/helpdesk-api ./cmd/server

# Final stage (minimal runtime image)
FROM alpine:latest

# Set working directory in the final image
WORKDIR /app

# Install runtime dependencies
RUN apk --no-cache add ca-certificates tzdata

# Copy ONLY the compiled binary from the build stage
COPY --from=build /app/helpdesk-api .

# Expose the port the Go app listens on
EXPOSE 8080

# Set the command to run the executable
CMD ["./helpdesk-api"]
