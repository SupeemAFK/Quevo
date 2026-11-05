FROM oven/bun:1 AS development
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
EXPOSE 3000
CMD ["bun", "--bun", "run", "dev"]

FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun --bun run build

FROM node:24-alpine AS production
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/.output ./.output
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
