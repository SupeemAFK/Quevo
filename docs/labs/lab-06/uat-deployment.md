# Lab 6 UAT deployment

The `staging` branch deploys to a separate Cloud Run UAT target. The `main` release workflow remains the production deployment and uses the GitHub `prod` environment. UAT reuses the existing GCP project, region, Cloud SQL instance, and Artifact Registry, but uses a separate database and separate Cloud Run resources.

## Google Cloud resources

| Resource | UAT value |
| --- | --- |
| Cloud SQL instance | `quevo-pg` (`cpe334-student-project:asia-southeast1:quevo-pg`) |
| Database | `quevo_uat` |
| Secret Manager secret | `quevo-uat-database-url`, version `1`, exposed as `DATABASE_URL` |
| Cloud Run API service | `quevo-uat-api` |
| Cloud Run web service | `quevo-uat-web` |
| Cloud Run migration job | `quevo-uat-migrate` |

The `DATABASE_URL` secret must target `quevo_uat`, and its database account must be able to create and update the application schema. The Cloud Run runtime service account needs Cloud SQL Client access to `quevo-pg` and Secret Manager Secret Accessor access to `quevo-uat-database-url`.

## GitHub configuration

Create a GitHub environment named `uat`, allow only the `staging` branch under **Deployment branches and tags**, and configure these environment variables:

| Variable | Value |
| --- | --- |
| `GCP_PROJECT_ID` | `cpe334-student-project` |
| `GCP_REGION` | `asia-southeast1` |
| `WIF_PROVIDER` | The configured Google Workload Identity Federation provider |
| `WIF_SERVICE_ACCOUNT` | The GitHub Actions deployment service account |
| `CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT` | The runtime service account used by `quevo-api` |

The WIF provider must trust the `staging` branch for this repository. Do not put the database URL in GitHub variables or secrets.

Create a GitHub environment named `prod`, allow only the `main` branch under **Deployment branches and tags**, and copy the deployment variables from the previous `demo` environment before merging the workflow rename. Keep `demo` until a production deployment through `prod` has succeeded.

## Deployment flow

Merging a reviewed pull request into `staging` runs CI, builds immutable API and web images, runs UAT database migrations, deploys the UAT API and web services, and checks their health endpoints. The API and web services use scale-to-zero and a small instance cap for UAT.

The first deployment creates the UAT Cloud Run resources. Subsequent staging commits update those UAT resources. The workflow does not deploy to the existing `quevo-api`, `quevo-web`, or `quevo-migrate` production resources.

The UAT database starts empty after migrations. Create synthetic test accounts through the documented private seeding process before sharing the UAT URL with testers; do not expose generated passwords in GitHub Actions logs.
