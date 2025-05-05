FROM nginx:alpine

# Install gettext for envsubst and bash for more robust script support
RUN apk add --no-cache gettext bash curl

# Copy the template nginx config
COPY nginx/nginx.conf.template /etc/nginx/templates/default.conf.template

# Copy the entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Expose ports
EXPOSE 80 443

# Use the custom entrypoint script
ENTRYPOINT ["/docker-entrypoint.sh"]

# Start nginx
CMD ["nginx", "-g", "daemon off;"]