# syntax=docker/dockerfile:1
# Nightcrawlers web image: the production FE build served by Caddy, which also proxies /api.
# Build context: the repository root (the image needs FE/ and the root Caddyfile), e.g.
#   docker build -f FE/Dockerfile --build-arg VITE_PRIVACY_EMAIL=privacy@example.org .

FROM --platform=$BUILDPLATFORM node:24-alpine AS build
WORKDIR /src
COPY FE/package.json FE/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund
COPY FE/ ./
# Privacy contact shown on the privacy page; empty -> the app's built-in fallback.
ARG VITE_PRIVACY_EMAIL=""
# Production always talks to the real API.
ENV VITE_API_MOCK=false \
    VITE_PRIVACY_EMAIL=${VITE_PRIVACY_EMAIL}
RUN npm run build \
    && test ! -e dist/game-dev.html

FROM caddy:2-alpine
# Run Caddy as an unprivileged user. Binding 80/443 needs no capability: Docker sets
# net.ipv4.ip_unprivileged_port_start=0 in container network namespaces. But the official binary
# carries the file capability cap_net_bind_service=ep, and execve of such a file fails unless that
# capability is in the bounding set: compose therefore drops all capabilities except
# NET_BIND_SERVICE. (Removing the file capability with setcap -r would copy the 18 MB binary into
# a new layer, costing GHCR quota on every version.) /data holds certificates and ACME state.
RUN addgroup -S caddy && adduser -S -G caddy -H -s /sbin/nologin caddy \
    && chown -R caddy:caddy /data /config
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /src/dist /srv
USER caddy
EXPOSE 80 443 443/udp
# The admin API listens on localhost inside the container only.
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD ["wget", "-q", "-O", "/dev/null", "http://127.0.0.1:2019/config/"]
