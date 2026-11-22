FROM oven/bun:1.4.4 AS deps
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
COPY apps/server/package.json apps/server/package.json
RUN bun install --frozen-lockfile --production --ignore-scripts --filter @velumn/server

FROM oven/bun:1.4.4-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
COPY --from=deps /app/node_modules node_modules
COPY --from=deps /app/apps/server/node_modules apps/server/node_modules
COPY apps/server/package.json apps/server/package.json
COPY apps/server/src apps/server/src
USER bun
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD bun -e "fetch('http://127.0.0.1:3000/health').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
ENTRYPOINT ["bun", "apps/server/src/main.ts"]
CMD ["http"]
