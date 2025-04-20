# Use an official Node.js image as the base
FROM mcr.microsoft.com/playwright:v1.38.0-focal

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json to the container
COPY package*.json ./

# Install dependencies (including Playwright)
RUN npm install

# Ensure Playwright browser binaries have execution permissions
RUN chmod -R 755 /ms-playwright

# Copy the rest of the application code to the container
COPY . .

# Expose the port your app runs on
EXPOSE 3000

# Start the application
CMD ["npm", "start"]