# Use an official Playwright image (includes Chromium, Firefox, WebKit)
FROM mcr.microsoft.com/playwright:v1.52.0-noble

# Allow overriding port at build time, default to 5000
ARG PORT=5000
ENV PORT=${PORT}

# Set the working directory
WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install dependencies (including Playwright browsers)
RUN npm install

# Fix permissions on Playwright binaries
RUN find /ms-playwright -type f -exec chmod +x {} \;

# Copy application source
COPY . .

# Ensure root user so we can bind low ports if needed
USER root

# Expose the chosen port
EXPOSE ${PORT}

# Start the app
CMD ["npm", "start"]
