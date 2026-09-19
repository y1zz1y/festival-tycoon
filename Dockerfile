# syntax=docker/dockerfile:1

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html tsconfig.json vite.config.ts ./
COPY public ./public
COPY src ./src
COPY server ./server
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8080
# The one writable place in the image: the volume the entrypoint chowns. The
# database used to default to /app/data, which nothing creates and the node
# user may not create either, so the first save request killed the server.
ENV HEADLINER_DATA_DIR=/app/saves
# The address players are given in an invite, when the host plays on this very
# machine. Behind a proxy set it to the public one, e.g.
# PUBLIC_HOST=https://headliner-tycoon.com
ENV PUBLIC_HOST=
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY server ./server
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN apk add --no-cache su-exec \
  && chmod +x /usr/local/bin/docker-entrypoint.sh \
  && mkdir -p /app/saves \
  && chown node:node /app/saves
VOLUME /app/saves
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "--experimental-strip-types", "server/serve.ts"]
