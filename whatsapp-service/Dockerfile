# DeployFleet WhatsApp Communication Layer (WA-0) — a plain Node
# process, host-agnostic per docs/whatsapp-intelligence-architecture.md
# §15's resolved hosting decision (Railway recommended, but this image
# runs anywhere a Dockerfile can be deployed: Fly.io, a small VPS, etc).
# Needs a persistent volume mounted at /app/.wa-auth so Baileys' session
# credentials survive a redeploy — losing that directory means scanning
# a new QR code.

FROM node:20-slim AS build
WORKDIR /app
# git is a real build-time dependency here, not an oversight: at least
# one package in Baileys' own dependency tree resolves via a git URL,
# so a plain `npm install` fails with ENOENT spawning git on an image
# that doesn't have it — confirmed against a real build on the demo
# server, not a theoretical concern.
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
VOLUME ["/app/.wa-auth"]
EXPOSE 8787
CMD ["node", "dist/index.js"]
