# Consumo Digital: servidor Node.js com SQLite nativo (node:sqlite), sem dependências compiladas.
FROM node:24-alpine

ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_PATH=/data/consumo.db \
    TRUST_PROXY=1

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY index.html ./
COPY assets ./assets
COPY server ./server

# O banco fica em um volume; o processo roda sem privilégios de root.
RUN mkdir -p /data && chown -R node:node /data /app
USER node
VOLUME ["/data"]
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/saude || exit 1

CMD ["node", "server/index.js"]
