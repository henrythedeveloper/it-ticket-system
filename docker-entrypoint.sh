#!/bin/bash
set -e

# Default values (can be overridden by environment variables)
: ${BACKEND_URL:="https://it-helpdesk-backend-3bvz.onrender.com"}
: ${FRONTEND_URL:="https://it-helpdesk-frontend.onrender.com"}

# Print configuration for debugging
echo "Configuring nginx with:"
echo "BACKEND_URL: $BACKEND_URL"
echo "FRONTEND_URL: $FRONTEND_URL"

# Generate nginx config from template
echo "Generating nginx configuration..."
envsubst '${BACKEND_URL} ${FRONTEND_URL}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

# Display generated config for debugging
echo "Generated nginx configuration:"
cat /etc/nginx/conf.d/default.conf

# Execute the command passed to docker run
exec "$@"