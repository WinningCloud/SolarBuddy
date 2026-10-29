# Build context is the repo root so the shared workspace package is available.
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages ./packages
COPY api/package.json ./api/
RUN npm ci --workspace api --include-workspace-root=false
COPY api ./api
RUN npm run build -w api

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY packages ./packages
COPY api/package.json ./api/
RUN npm ci --workspace api --include-workspace-root=false --omit=dev
COPY --from=build /app/api/dist ./api/dist
COPY data ./data
EXPOSE 4000
CMD ["node", "api/dist/index.js"]
