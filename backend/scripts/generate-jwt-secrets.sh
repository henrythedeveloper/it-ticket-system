#!/bin/bash

# Exit on error
set -e

echo "Generating secure JWT secrets..."

# Get the directory of this script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Compile and run the Go script
cd "$DIR"
go run generate-secrets.go

echo ""
echo "Copy these values into your .env file to secure your application."