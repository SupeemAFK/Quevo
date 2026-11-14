FROM golang:1.26-alpine AS development
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
EXPOSE 8080
CMD ["go", "run", "./cmd/server"]

FROM golang:1.26-alpine AS build
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
ENV CGO_ENABLED=0
RUN go build -trimpath -ldflags="-s -w" -o /out/quevo-api ./cmd/server && \
    go build -trimpath -ldflags="-s -w" -o /out/quevo-migrate ./cmd/migrate && \
    go build -trimpath -ldflags="-s -w" -o /out/quevo-seed ./cmd/seed

FROM alpine:3.22 AS production
RUN apk add --no-cache ca-certificates && addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --from=build /out/ /app/
USER app
EXPOSE 8080
ENTRYPOINT ["./quevo-api"]
