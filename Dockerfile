# Reproducible offline-capable web build. The optional Python model tooling is
# deliberately not part of the runtime image; the shipped browser model and
# heuristic fallback are self-contained in dist/.
FROM node:24.9.0-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime: serve dist/ with the zero-dependency static server (serve.cjs).
# npm IS NOT used here — vite is a devDependency, so `npm ci --omit=dev` +
# `npm run preview` would fail. Only node + the dist bundle are needed.
FROM node:24.9.0-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY serve.cjs ./
EXPOSE 4173
CMD ["node", "serve.cjs"]
