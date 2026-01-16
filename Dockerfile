# ---- Web build (Vite) ----
FROM node:20-alpine AS webbuild
WORKDIR /app/js

# Install deps
COPY js/package.json js/pnpm-lock.yaml* ./
RUN corepack enable && pnpm install --frozen-lockfile

# Build
COPY js/ ./
RUN pnpm build

# ---- Go build ----
FROM golang:1.23.2-alpine AS gobuild
WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

# Copy Vite build output into server static folder.
# If your Vite outputs to js/dist, this will populate static/dist.
COPY --from=webbuild /app/js/dist ./static/dist

# Ensure templ is generated if you don't commit *_templ.go
RUN go install github.com/a-h/templ/cmd/templ@latest && templ generate

RUN CGO_ENABLED=0 go build -o server .

# ---- Runtime ----
FROM alpine:3.20
WORKDIR /app

COPY --from=gobuild /app/server /app/server
COPY --from=gobuild /app/static /app/static

# Render provides PORT (default 10000) :contentReference[oaicite:1]{index=1}
CMD ["sh","-c","GO_PORT=${PORT:-10000} ENV=production ./server"]
