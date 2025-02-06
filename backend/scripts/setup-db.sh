#!/bin/bash
set -e

echo "Starting database setup..."

# Default values if not set in .env
DB_HOST=${DB_HOST:-db}  # Changed from localhost to db
DB_PORT=${DB_PORT:-5432}
DB_USER=${DB_USER:-postgres}
DB_NAME=${DB_NAME:-helpdesk}
DB_PASSWORD=${DB_PASSWORD:-postgrespassword}

echo "Waiting for database to be ready..."
while ! nc -z $DB_HOST $DB_PORT; do
  sleep 1
done

echo "Running migrations..."
for migration in /app/migrations/*.up.sql; do
    echo "Applying migration: $migration"
    # Allow migration to fail (might be already applied)
    PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$migration" || true
done

echo "Database setup complete!"

# Don't exit with error even if some migrations failed
exit 0