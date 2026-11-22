FROM oven/bun:1.4.4 AS deps
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
COPY apps/server/package.json apps/server/package.json
RUN bun install --frozen-lockfile --production --ignore-scripts

FROM oven/bun:1.4.4-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules node_modules
COPY apps/server apps/server
USER bun
EXPOSE 3000
WORKDIR /app/apps/server
CMD ["bun", "src/main.ts"]
