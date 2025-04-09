# Build stage
FROM golang:1.24-alpine AS build

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git

# Copy go.mod and go.sum files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy the source code
COPY . .

# Build the Go app
RUN CGO_ENABLED=0 GOOS=linux go build -o helpdesk-api ./cmd/server

# Final stage
FROM alpine:latest

WORKDIR /app

# Install runtime dependencies
RUN apk --no-cache add ca-certificates tzdata

# Copy the binary from the build stage
COPY --from=build /app/helpdesk-api .

# Copy migrations
COPY --from=build /app/migrations ./migrations

# Expose the port
EXPOSE 8080

# Run the binary
CMD ["./helpdesk-api"]