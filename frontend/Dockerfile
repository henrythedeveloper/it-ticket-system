# Build stage
FROM node:23-alpine AS build

# Build arguments (Use PUBLIC_ prefix if you rename the var)
ARG PUBLIC_API_URL=/api

WORKDIR /app

# Copy package.json and package-lock.json (or yarn.lock)
COPY package*.json ./
# COPY yarn.lock ./ # Uncomment if using Yarn

# Install dependencies
RUN npm install
# RUN yarn install # Uncomment if using Yarn

# Copy the rest of the application code
COPY . .

# Set the environment variable for the build process
ENV PUBLIC_API_URL=${PUBLIC_API_URL}
# Build the application using Rsbuild
RUN npm run build

# Production stage
FROM nginx:alpine AS production

# Copy built assets from build stage (Rsbuild outputs to 'dist' by default)
# Copy from the 'dist' folder in the build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Add custom nginx config if needed
COPY nginx.default.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]