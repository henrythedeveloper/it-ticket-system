# Build stage
FROM golang:1.24-alpine AS build

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git

# Copy go.mod and go.sum files from the 'backend' subdirectory in the build context
COPY backend/go.mod backend/go.sum ./

# Download dependencies
# This command now expects go.mod and go.sum to be in /app (which they are after the corrected COPY)
RUN go mod download

# Copy the rest of the source code FROM THE REPO ROOT into the container's /app directory
# Note: This copies everything, including frontend, nginx etc. into the backend build stage.
# Consider using a more specific COPY if build times become an issue.
COPY . .

# Build the Go app using the full module path
RUN CGO_ENABLED=0 GOOS=linux go build -o helpdesk-api github.com/henrythedeveloper/it-ticket-system/backend/cmd/server

# Final stage
FROM alpine:latest

WORKDIR /app

# Install runtime dependencies
RUN apk --no-cache add ca-certificates tzdata

# Copy the binary from the build stage
COPY --from=build /app/helpdesk-api .

# Expose the port the Go app listens on
EXPOSE 8080

# Run the binary
CMD ["./helpdesk-api"]
