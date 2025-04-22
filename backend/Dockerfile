# Use an official Node.js image as the base
FROM mcr.microsoft.com/playwright:v1.52.0-noble

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json to the container
COPY package*.json ./

# Install dependencies (including Playwright)
RUN npm install

# Fix permissions on browser binaries
RUN find /ms-playwright -type f -exec chmod +x {} \;

# Copy the rest of the application code to the container
COPY . .

# Ensure the container runs as root
USER root

# Expose the port your app runs on
EXPOSE 3000

# Start the application
CMD ["npm", "start"]