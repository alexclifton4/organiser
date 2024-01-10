FROM node:21-alpine
WORKDIR /app
COPY package.json ./
COPY package-lock.json ./
RUN npm ci
COPY . /app
EXPOSE 8080
CMD ["node", "server.js"]