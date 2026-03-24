# Estágio 1: build do React
FROM node:20-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# Build com API apontando para caminho relativo (Nginx faz o proxy)
RUN VITE_API_BASE_URL="" npm run build

# Estágio 2: serve com Nginx
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD curl -f http://localhost/health.txt || exit 1

CMD ["nginx", "-g", "daemon off;"]
