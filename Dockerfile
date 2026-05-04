FROM node:18-alpine

# Create a non-root user
RUN adduser -D appuser

# Set working directory
WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --only=production

# Copy application source
COPY . .

# Use non-root user for running the app
USER appuser

EXPOSE 3000

CMD [ "npm", "start" ]