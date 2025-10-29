# Etapa de build
FROM node:23.6.0-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Etapa final
FROM node:23.6.0-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install --only=production

COPY resources/ ./resources/

COPY --from=builder /app/dist ./dist

EXPOSE 8080

ENV NODE_ENV=production
ENV PORT=8080
CMD ["node", "dist/main"]