FROM node:20-alpine AS builder
WORKDIR /app
# Install native build tools needed by better-sqlite3
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
# Install runtime dependency for native modules
RUN apk add --no-cache libstdc++
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
ENV NODE_ENV=production
EXPOSE 5000
CMD ["node", "dist/index.cjs"]
