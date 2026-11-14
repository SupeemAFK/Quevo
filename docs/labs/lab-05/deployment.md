# Lab 5 deployment guide

## Stack

Quevo uses TanStack Start with a Node.js production runtime for the web app, a Go/Gin API, and PostgreSQL. The web server calls the API through TanStack server functions. The browser connects to the web app.

The Student Guide packages its web app and API together. Quevo already has separate Dockerfiles for its web and API services, so the planned GCP setup keeps them separate. It uses Cloud Run for the two services, Artifact Registry for their images, Cloud SQL for PostgreSQL, Secret Manager for runtime secrets, and GitHub Actions for CI and deployment. Keep the public entry point on the web service and configure the web server to reach the API.

| GCP resource | Value |
| --- | --- |
| Project ID and region | `cpe334-student-project`, `asia-southeast1` |
| Cloud Run web, API, and migration job | `quevo-web`, `quevo-api`, `quevo-migrate`; the workflow records the web URL and deployed revisions in its run summary. |
| Artifact Registry repository and images | `asia-southeast1-docker.pkg.dev/cpe334-student-project/quevo` with images `api` and `web` |
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
| `API_BASE_URL` | Web server | Base URL the web server uses to call the Go API | No | Defaults to `http://localhost:8080` for standalone development. Compose supplies `http://api:8080`. Set the deployed API endpoint in the Cloud Run web service environment. |
| `NODE_ENV` | Web server | Enables secure session cookies in production | No | The production web Dockerfile sets `production`. |
| `POSTGRES_DB`, `POSTGRES_USER` | Local PostgreSQL container | Initial database and username | No | Local defaults in Compose. Create the database and user separately for Cloud SQL. |
| `POSTGRES_PASSWORD` | Local PostgreSQL container | Initial database user password | Yes outside local development | Compose defines a disposable local value. Cloud SQL credentials are provisioned separately and consumed through `DATABASE_URL`. |

## Build, test, and run locally

From the repository root, build the Compose images and start PostgreSQL:

```sh
docker compose build
docker compose up -d --wait db
```

From the root, copy the API environment example. Fill in the database URL using the local database name, username, password, and published port in Compose. Use a private terminal for the seed so you can save the generated passwords.

```sh
cp apps/api/.env.example apps/api/.env
```

Apply the migrations and seed the database from the repository root. The commands run in `apps/api`, where the Go config loader reads `.env`.

```sh
make -C apps/api migrate-up
make -C apps/api seed-demo
docker compose up --build
```

Open the web app at `http://localhost:3000`. Sign in as `customer@quevo.local` or `operator@quevo.local` using the passwords shown when the seed created those accounts. If running the API outside Compose, start it from `apps/api` and restart it after editing its `.env`. The app reads config on startup. API health alone does not verify database access.

To run the repository's test suite, stop the local stack with `docker compose down` to free the API and web ports, then run `make test` from the root. See the [test prerequisites](../../../README.md#test) for Docker, toolchains, and Playwright Chromium. The PostgreSQL integration and browser suites use isolated test databases.

## Persistent data

Versioned migrations define the users, sessions, branches, services, operator assignments, queue counters, and tickets in PostgreSQL. The web cookie carries the opaque session token. The API validates it against the session record stored in PostgreSQL. Local Compose keeps database files in its `postgres-data` volume. The GCP deployment will use Cloud SQL so replacing an app container leaves those records in place. The live restart and redeploy check is tracked in [#38](https://github.com/SupeemAFK/Quevo/issues/38).

Run migrations as a separate release step before updating the API. Seed the lab database from a private terminal through the Cloud SQL Auth Proxy when demo accounts are needed. Use a local proxy endpoint in `DATABASE_URL` for that command. The seed generates and displays each new account’s password once. Reruns preserve existing passwords. Keep seeding separate from routine releases.

## Release procedure

The reusable CI workflow is `.github/workflows/ci.yml`, displayed as **CI**. Its `test` job name remains unchanged for the required branch-protection check. Feature and fix branches enter `staging` through teammate-reviewed PRs. A release PR promotes `staging` to `main` after the required CI checks pass. Merging that release PR pushes a commit to `main` and triggers `.github/workflows/deploy.yml`, displayed as **CD**; changes pushed to feature branches or merged only into `staging` do not deploy.

CD waits for CI and serializes deployments to the `demo` environment. It skips a commit if `main` has advanced before migrations begin. Once a migration starts, the active release holds the concurrency lock and completes its API and web updates before another queued release can run. This keeps the running app compatible with the schema after migration. CD builds the API and web production images, pushes them to Artifact Registry at `quevo/api` and `quevo/web` tagged with the full commit SHA, and resolves their immutable digests. It updates and executes the `quevo-migrate` Cloud Run job before updating `quevo-api` and `quevo-web`. It then verifies the public web URL, the expected images on the latest ready revisions, and that each revision receives 100% of production traffic.

For each release, open the **CD** workflow run for the merge commit in GitHub Actions. Its run summary records the commit SHA, public URL, image digests, and Cloud Run revision names. To check the running revision independently, run these commands with `GCP_PROJECT_ID` and `GCP_REGION` set to the values in the GitHub `demo` environment:

```sh
gcloud run services describe quevo-api \
  --project "$GCP_PROJECT_ID" --region "$GCP_REGION" \
  --format='value(status.latestReadyRevisionName)'
gcloud run services describe quevo-web \
  --project "$GCP_PROJECT_ID" --region "$GCP_REGION" \
  --format='value(status.latestReadyRevisionName)'
```

Record the release PR, **CD** run, deployed commit SHA, image digests, and revisions in the Lab 5 evidence index. Keep issue [#37](https://github.com/SupeemAFK/Quevo/issues/37) open until a visible change has gone through the complete `staging` to `main` release flow and the live deployment evidence is recorded.
