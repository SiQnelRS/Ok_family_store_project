FROM node:24-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS build
COPY . .
RUN npm ci
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run db:generate && npm run build

FROM build AS migrate
USER node
CMD ["npm", "run", "db:deploy"]

FROM build AS production-dependencies
RUN npm prune --omit=dev --ignore-scripts

FROM base AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=production-dependencies --chown=node:node /app /app
RUN install -d -o node -g node /var/lib/ok-family/uploads
USER node
