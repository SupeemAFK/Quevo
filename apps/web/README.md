# Quevo Web

Quevo's web app uses React, TypeScript, TanStack Start, and Bun for package management and development.

## Run locally

```sh
bun install --frozen-lockfile
bun --bun run dev
```

The app listens on `http://localhost:3000`. It calls the Go API from a TanStack server function and uses `openapi-fetch` with types generated from the Go OpenAPI document. Set `API_BASE_URL` when the API is not at `http://localhost:8080`.

## Build and serve

```sh
bun --bun run build
bun run start
```

The production server uses TanStack Start's Node adapter output.


## API client generation

After changing Go API annotations or response types, regenerate the spec and TypeScript client:

```sh
cd ../api && make generate-openapi
cd ../web && bun run generate:api
```

`openapi-typescript` generates `src/client/api/schema.d.ts`. Run `bun run check:api` to verify it matches the Go spec. `src/lib/api.ts` is the server-only API boundary and combines the typed request with TanStack Query. Run web unit and component tests with `bun run test`; Vitest uses the Node version in the repository's `.nvmrc`. shadcn components live in `src/components/ui`; add more with `bun --bun x shadcn add <component>`.
