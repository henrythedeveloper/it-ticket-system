#!/bin/bash
set -e

# Default values (can be overridden by environment variables)
: ${BACKEND_URL:="https://it-helpdesk-backend-3bvz.onrender.com"}
: ${FRONTEND_URL:="http://localhost:80"}

# Print configuration for debugging
echo "Configuring nginx with:"
echo "BACKEND_URL: $BACKEND_URL"
echo "FRONTEND_URL: $FRONTEND_URL"

# Special handling for backend URL - ensure it has correct endpoint format
# If URL doesn't end with /api, make sure it's configured correctly
if [[ "$BACKEND_URL" != *"/api" ]]; then
    # If the URL already has a path beyond the domain, we need different handling
    if [[ "$BACKEND_URL" == *"/"* && "$BACKEND_URL" != *"/" ]]; then
        # URL has a path but doesn't end with /
        BACKEND_URL="${BACKEND_URL}/"
    fi
    echo "Adjusted BACKEND_URL: $BACKEND_URL"
fi

# Generate nginx config from template
echo "Generating nginx configuration..."
envsubst '${BACKEND_URL} ${FRONTEND_URL}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

# Display generated config for debugging
echo "Generated nginx configuration:"
cat /etc/nginx/conf.d/default.conf

# Execute the regular docker entrypoint
echo "Starting original entrypoint..."
exec /docker-entrypoint-orig.sh "$@"