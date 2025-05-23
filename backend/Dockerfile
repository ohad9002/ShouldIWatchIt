# Use an official Playwright image (includes Chromium + deps)
FROM mcr.microsoft.com/playwright:v1.52.0-noble

# Allow build-time override of PORT (default 5000)
ARG PORT=5000
ENV PORT=${PORT}

WORKDIR /app

# Copy manifests & install deps
COPY package*.json ./
RUN npm install

# Make sure the Playwright binaries are executable
RUN find /ms-playwright -type f -exec chmod +x {} \;

# Copy the rest of the code
COPY . .

# Expose the port we’ll bind to
EXPOSE ${PORT}

# Run as root so that --no-sandbox works
USER root

# Start the app
CMD ["npm", "start"]
