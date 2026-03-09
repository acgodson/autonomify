FROM node:22-slim

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install

# Copy server
COPY server.js ./

# Create circuit directory and copy circuit file
RUN mkdir -p circuit
COPY circuit/autonomify.json ./circuit/

EXPOSE 3001

CMD ["node", "server.js"]

