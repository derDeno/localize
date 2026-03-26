FROM node:24-bookworm-slim AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV POSTGRES_HOST=postgres
ENV POSTGRES_PORT=5432
ENV POSTGRES_DB=localize
ENV POSTGRES_USER=localize
ENV POSTGRES_PASSWORD=localize

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public
COPY --from=build /app/server ./server
COPY --from=build /app/scripts ./scripts

RUN chmod +x ./scripts/docker-entrypoint.sh

VOLUME ["/app/data"]
EXPOSE 3001

CMD ["sh", "./scripts/docker-entrypoint.sh"]
