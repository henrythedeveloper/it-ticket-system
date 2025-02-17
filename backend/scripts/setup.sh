#!/bin/bash

# Generate JWT secrets and environment variables
echo "Generating secrets..."
go run cmd/generate_secrets/main.go

# Set up database
echo "Setting up database..."
./scripts/setup-db.sh

echo "Setup complete!"