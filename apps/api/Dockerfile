# Build context: repo root (docker build -f apps/api/Dockerfile .)
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
RUN npm ci -w apps/api
COPY apps/api apps/api
# Also runs `prisma generate`, which needs no database
RUN npm run build -w apps/api

# One-shot job applying pending migrations. Kept out of the runtime image
# because the Prisma CLI is a heavy dev dependency.
FROM build AS migrate
WORKDIR /app/apps/api
USER node
CMD ["../../node_modules/.bin/prisma", "migrate", "deploy"]

FROM node:24-alpine AS run
WORKDIR /app
ENV NODE_ENV=production API_PORT=4000
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
# npm keeps the Prisma CLI (optional peer of @prisma/client) despite
# --omit=dev; the generated client does not need it at runtime
RUN npm ci -w apps/api --omit=dev \
  && npm uninstall -w apps/api prisma --omit=dev \
  && npm cache clean --force
COPY --from=build /app/apps/api/dist apps/api/dist
USER node
EXPOSE 4000
CMD ["node", "apps/api/dist/main.js"]
