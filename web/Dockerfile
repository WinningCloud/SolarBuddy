# Build context is the repo root so workspace packages resolve.
FROM node:20-alpine AS build
WORKDIR /app
ARG VITE_API_URL=http://localhost:4000
ENV VITE_API_URL=$VITE_API_URL
COPY package.json package-lock.json ./
COPY packages ./packages
COPY web/package.json ./web/
RUN npm ci --workspace web --include-workspace-root=false
COPY web ./web
RUN npm run build -w web

FROM nginx:1.27-alpine
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/web/dist /usr/share/nginx/html
EXPOSE 80
