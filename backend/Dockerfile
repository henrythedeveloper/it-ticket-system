FROM golang:1.23.5-alpine AS builder
WORKDIR /app
# Install build dependencies including gcc
RUN apk add --no-cache gcc musl-dev netcat-openbsd
# Copy go mod and sum files
COPY go.mod go.sum ./
# Download dependencies
RUN go mod download
# Copy source code and .env
COPY . .
# Build the application
RUN CGO_ENABLED=1 GOOS=linux go build -o ./bin/server ./cmd/server/main.go

FROM alpine:latest
WORKDIR /app
# Install runtime dependencies
RUN apk add --no-cache ca-certificates tzdata postgresql-client netcat-openbsd dos2unix bash
# Copy binary from builder
COPY --from=builder /app/bin/server .
# Copy migrations and setup script
COPY migrations/ /app/migrations/
COPY scripts/setup-db.sh setup-db.sh
COPY .env .env
# Ensure script has correct line endings and is executable
RUN dos2unix setup-db.sh && \
    chmod +x setup-db.sh
# Expose port
EXPOSE 8080
# Run setup and server
CMD ["sh", "-c", "./setup-db.sh && ./server"]