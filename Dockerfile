FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY index.html vite.config.js ./
COPY src ./src
COPY public ./public
RUN npm run build

FROM node:24-slim
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY server ./server
ENV CENTINELA_WEB_PORT=8080 CENTINELA_WEB_BIND=0.0.0.0 CENTINELA_WEB_DATA=/app/data
RUN mkdir /app/data && chown node:node /app/data
USER node
EXPOSE 8080
CMD ["node", "server/main.mjs"]
