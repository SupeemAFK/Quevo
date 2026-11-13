# Lab 5 deployment guide

## Stack

Quevo uses TanStack Start with a Node.js production runtime for the web app, a Go/Gin API, and PostgreSQL. The web server calls the API through TanStack server functions. The browser connects to the web app.

The Student Guide packages its web app and API together. Quevo already has separate Dockerfiles for its web and API services, so the planned GCP setup keeps them separate. It uses Cloud Run for the two services, Artifact Registry for their images, Cloud SQL for PostgreSQL, Secret Manager for runtime secrets, and GitHub Actions for CI and deployment. Keep the public entry point on the web service and configure the web server to reach the API.

| GCP resource | Value |
| --- | --- |
| Project ID and region | Record the shared project ID and chosen region before first deployment. |
| Cloud Run web and API services | Record names and service URLs at first deployment. |
| Artifact Registry repository | Record the repository name and region at first deployment. |
| Cloud SQL instance and database | Record resource names at first deployment. |
| Runtime secrets | Record Secret Manager resource names and consumers. |

## Environment variables

Commit example files with placeholders or local endpoints. Keep real values in ignored local files or the shell for development, and supply deployment secrets through Secret Manager. Both Docker build contexts exclude `.env` and `.env.*` files.

| Variable | Used by | Purpose | Secret | Value source |
| --- | --- | --- | --- | --- |
| `PORT` | API and production web server | HTTP listen port | No | API defaults to `8080`. The local web dev script uses `3000`. Use the runtime port supplied for each deployed service. |
| `DATABASE_URL` | API, migrate, seed | PostgreSQL connection URL. Required for database-backed workflows. | Yes | Locally, construct it from the Compose database settings. On GCP, supply the Cloud SQL connection URL from Secret Manager. |
| `DB_MAX_IDLE_CONNS` | API, migrate, seed | Maximum idle connections in the database pool | No | API default `5` or an environment override. |
| `DB_MAX_OPEN_CONNS` | API, migrate, seed | Maximum open connections in the database pool | No | API default `10` or an environment override. |
| `DB_CONN_MAX_LIFETIME` | API, migrate, seed | Maximum time a pooled connection can be reused | No | API default `30m` or an environment override. |
| `SESSION_TTL` | API | Lifetime of a newly created sign-in session | No | API default `12h` or an environment override. |
| `QUEVO_CUSTOMER_PASSWORD` | Seed command | Password for the demo customer | Yes | Supply locally through the shell or an ignored API `.env`. For a lab seed run on GCP, supply it through Secret Manager. |
| `QUEVO_OPERATOR_PASSWORD` | Seed command | Password for the demo operator | Yes | Supply locally through the shell or an ignored API `.env`. For a lab seed run on GCP, supply it through Secret Manager. |
| `API_BASE_URL` | Web server | Base URL the web server uses to call the Go API | No | Defaults to `http://localhost:8080` for standalone development. Compose supplies `http://api:8080`. Set the deployed API endpoint in the Cloud Run web service environment. |
| `NODE_ENV` | Web server | Enables secure session cookies in production | No | The production web Dockerfile sets `production`. |
| `POSTGRES_DB`, `POSTGRES_USER` | Local PostgreSQL container | Initial database and username | No | Local defaults in Compose. Create the database and user separately for Cloud SQL. |
| `POSTGRES_PASSWORD` | Local PostgreSQL container | Initial database user password | Yes outside local development | Compose defines a disposable local value. Cloud SQL credentials are provisioned separately and consumed through `DATABASE_URL`. |
| `POSTGRES_PORT` | Compose | Published PostgreSQL port on the host | No | Defaults to `5432`. Export another port when a local database already uses it; use the same port in the host-side `DATABASE_URL`. Container-to-container traffic continues to use `db:5432`. |

## Build, test, and run locally

The commands below require Docker with Compose, Make, and Go 1.26 or later on the host. Migration and seed commands run on the host. The application dependencies are installed inside the Docker images.

Run from a fresh clone. If port `5432` is occupied, first export an available port, for example `export POSTGRES_PORT=55433`, and use that port when filling in the API environment example. To isolate containers and volumes from another Quevo checkout, also export `COMPOSE_PROJECT_NAME=quevo-c03` for the whole session.

From the repository root, build the Compose images and start PostgreSQL:

```sh
docker compose build
docker compose up -d --wait db
```

From the root, copy the API environment example. Fill in the database URL using the local database name, username, password, and published port in Compose. Choose both demo passwords before running the seed.

```sh
cp apps/api/.env.example apps/api/.env
```

Apply the migrations and seed the database from the repository root. The commands run in `apps/api`, where the Go config loader reads `.env`.

```sh
make -C apps/api migrate-up
make -C apps/api seed-demo
docker compose up --build
```

Open the web app at `http://localhost:3000`. Sign in as `customer@quevo.local` or `operator@quevo.local` using the passwords supplied to the seed command. If running the API outside Compose, start it from `apps/api` and restart it after editing its `.env`. The app reads config on startup. API health alone does not verify database access.

To run the repository's test suite, stop the local stack with `docker compose down` to free the API and web ports, then run `make test` from the root. See the [test prerequisites](../../../README.md#test) for Docker, toolchains, and Playwright Chromium. The PostgreSQL integration and browser suites use isolated test databases.

## Persistent data

Versioned migrations define the users, sessions, branches, services, operator assignments, queue counters, and tickets in PostgreSQL. The web cookie carries the opaque session token. The API validates it against the session record stored in PostgreSQL. Local Compose keeps database files in its `postgres-data` volume. The GCP deployment will use Cloud SQL so replacing an app container leaves those records in place. The live restart and redeploy check is tracked in [#38](https://github.com/SupeemAFK/Quevo/issues/38).

Run migrations as a separate release step before updating the API. Seed the lab database explicitly after migration when demo accounts are needed. The seed can be rerun and updates the demo credentials, so it is a setup operation separate from routine releases.

## Release procedure

Feature and fix branches enter `staging` through teammate-reviewed PRs. A release PR promotes `staging` to `main` after the required CI checks pass. The planned deploy workflow releases the accepted commit from `main`. Record the pipeline run, image identifier, and serving Cloud Run revisions alongside the commit SHA. Fill in the workflow name and exact revision lookup when the pipeline is implemented in [#37](https://github.com/SupeemAFK/Quevo/issues/37).
