# Lab 5 evidence index

The application evidence is pinned to [`82cd9c9693ea4e73f514929a09960647d56ef0ca`](https://github.com/SupeemAFK/Quevo/commit/82cd9c9693ea4e73f514929a09960647d56ef0ca). The [deployment guide](deployment.md) records resource names and reproduction and release commands. The [Lab 5 milestone](https://github.com/SupeemAFK/Quevo/milestone/1), [team board](https://github.com/users/SupeemAFK/projects/14/views/1), and [documentation release PR #53](https://github.com/SupeemAFK/Quevo/pull/53) track the handoff.

| Check | Evidence and result |
| --- | --- |
| C-01 · Passing CI | [PR #50 CI](https://github.com/SupeemAFK/Quevo/actions/runs/43635789360) passed tests and production builds. The [main release CI](https://github.com/SupeemAFK/Quevo/actions/runs/43636901594/job/132575587196) passed web, Go, PostgreSQL integration, provider, and Playwright checks. |
| C-02 · Blocked merge | [Issue #36](https://github.com/SupeemAFK/Quevo/issues/36#issuecomment-6880285921) records the main required check and [PR #45](https://github.com/SupeemAFK/Quevo/pull/45), which was blocked by a failing check and closed unmerged. |
| C-03 · Clean Docker run | [Issue #33](https://github.com/SupeemAFK/Quevo/issues/33#issuecomment-6862155429) captures the earlier Compose verification. The separate [clean-archive replay below](#c-03-clean-archive-replay) records its exact revision, commands, and HTTP results. |
| C-04 · Public workflow | [Issue #35](https://github.com/SupeemAFK/Quevo/issues/35#issuecomment-6879834901) shows customer sign-in, queuing and operator actions on the [public app](https://quevo-web-202441143194.asia-southeast1.run.app/). The [duplicate rejection](https://github.com/SupeemAFK/Quevo/issues/35#issuecomment-6879910771) shows the business rule. |
| C-05 · Persistence | [Issue #38](https://github.com/SupeemAFK/Quevo/issues/38#issuecomment-6884088932) records ticket 6 after the pipeline redeploy. The earlier comment shows both Cloud Run service updates and repeats the original ticket image. A separate local run read the same PostgreSQL ticket before restart, after restart, and after forced API container recreation. |
| C-06 · Repeatable release | [PR #46](https://github.com/SupeemAFK/Quevo/pull/46#pullrequestreview-5906255781) and [PR #48](https://github.com/SupeemAFK/Quevo/pull/48#pullrequestreview-5906542114) have teammate review and went to staging. [PR #49](https://github.com/SupeemAFK/Quevo/pull/49#pullrequestreview-5906557341) promoted them to main, and the [pipeline ran successfully](https://github.com/SupeemAFK/Quevo/actions/runs/43629504437). PRs #50 and #51 delivered the visible change without recorded approving reviews. Their [successful deployment](https://github.com/SupeemAFK/Quevo/actions/runs/43636901594) verified that both Cloud Run revisions served `82cd9c9`. |

## C-03 clean-archive replay

On November 15, 2026, a fresh archive of commit `82cd9c9693ea4e73f514929a09960647d56ef0ca` was run with a separate Compose project and an empty PostgreSQL volume. From a local clone containing that commit, run:

```sh
revision=82cd9c9693ea4e73f514929a09960647d56ef0ca
run_dir=$(mktemp -d)
git archive "$revision" | tar -x -C "$run_dir"
cd "$run_dir"

export COMPOSE_PROJECT_NAME=quevo_final_evidence
docker compose build
docker compose up -d --wait db api web
docker compose exec -T api go run ./cmd/migrate
# The seed prints synthetic demo passwords. Run privately and omit them from evidence.
docker compose exec -T api go run ./cmd/seed -allow-piped-output
docker compose ps
curl -fsS -w '\nHTTP %{http_code}\n' http://localhost:8080/api/v1/health
curl -fsS -o /dev/null -w 'HTTP %{http_code}\n' http://localhost:3000/
docker compose down --volumes
```

| Step | Observed result |
| --- | --- |
| Build and start | API and web images built. Compose reported PostgreSQL, API, and web started. |
| Migrate and seed | The migration command reported `database migrations applied`. The seed exited successfully and generated credentials for the synthetic accounts. |
| API health | HTTP 200 with `{"status":"healthy!"}`. |
| Web root | HTTP 200 with the response body discarded. |

Run on a machine with the Compose ports 3000, 5432, and 8080 free. The final command removes the rehearsal's containers and database volume.

## Setup and team evidence

[Issue #30](https://github.com/SupeemAFK/Quevo/issues/30) records budget alerts, [#31](https://github.com/SupeemAFK/Quevo/issues/31) records shared project access, and [#35](https://github.com/SupeemAFK/Quevo/issues/35) records Cloud SQL, Secret Manager, Artifact Registry, and the initial deployment. SupeemAFK led public deployment and merge-gate evidence. jarbbie documented the Docker and persistence checks and authored the deployment workflow.

Issue [#39](https://github.com/SupeemAFK/Quevo/issues/39) tracks the deployment documentation and Lab 5 handoff.
