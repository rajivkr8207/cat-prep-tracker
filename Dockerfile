FROM node:20-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN MONGO_URI=mongodb://127.0.0.1:27017/build \
    JWT_ACCESS_SECRET=build-only-access-secret-placeholder \
    JWT_REFRESH_SECRET=build-only-refresh-secret-placeholder \
    JWT_ACCESS_EXPIRES_IN=15m \
    JWT_REFRESH_EXPIRES_IN=7d \
    npm run build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

USER nextjs

EXPOSE 3000

CMD ["npm", "run", "dev"]
