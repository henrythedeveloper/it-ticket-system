# Use the official lightweight Nginx image based on Alpine Linux
FROM nginx:alpine

# Install gettext package which provides the 'envsubst' utility
RUN apk add --no-cache gettext

# Copy the Nginx configuration template into the location Nginx expects for templates
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template

# Remove the default Nginx configuration
RUN rm /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Use the official Nginx entrypoint script, but modify the CMD
# The entrypoint script will look for *.template files in /etc/nginx/templates/
# and run envsubst on them before starting Nginx.
# We just need to ensure Nginx starts in the foreground.
CMD ["nginx", "-g", "daemon off;"]
