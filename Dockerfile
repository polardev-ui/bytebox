# Use Microsoft's official Playwright image which includes Node.js and all browser dependencies
FROM mcr.microsoft.com/playwright:v1.45.0-jammy

# Set the working directory inside the container
WORKDIR /app

# Copy package installation definitions
COPY package*.json ./

# Install dependencies inside the container
RUN npm ci

# Copy the rest of the application files
COPY . .

# Expose the internal network port your Express app listens on
EXPOSE 8080

# Define the execution command to launch your server directly
CMD ["node", "server.js"]