#!/bin/bash
set -e

echo "Setting up Go backend..."

# Change to backend directory
cd "$(dirname "$0")/.."

# Initialize Go workspace if needed
if [ ! -f go.work ]; then
    echo "Initializing Go workspace..."
    go work init
fi

# Clean Go cache
go clean -modcache

# Download dependencies
echo "Downloading dependencies..."
go mod download

# Verify dependencies
echo "Verifying dependencies..."
go mod verify

# Tidy up the modules
echo "Tidying modules..."
go mod tidy

# Vendor dependencies for reproducible builds
echo "Vendoring dependencies..."
go mod vendor

# Make database migration scripts executable
echo "Setting up database scripts..."
chmod +x scripts/setup-db.sh
if [ -f scripts/generate-secrets.go ]; then
    chmod +x scripts/generate-secrets.go
fi

# Check if modules can be loaded
echo "Verifying module setup..."
go list -m all

echo "Backend setup complete!"

# Verify installation by displaying module dependencies
go list -m all | grep -E "gin-gonic|jwt|godotenv|lib/pq|crypto"