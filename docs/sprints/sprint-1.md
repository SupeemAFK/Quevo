# Sprint 1 release and verification

Sprint 1 delivered a working customer and operator queue on the web, Go API, and PostgreSQL. The submitted application revision is [`82cd9c9693ea4e73f514929a09960647d56ef0ca`](https://github.com/SupeemAFK/Quevo/commit/82cd9c9693ea4e73f514929a09960647d56ef0ca). Issue [#24](https://github.com/SupeemAFK/Quevo/issues/24) tracks integration and acceptance. The [documentation release PR #53](https://github.com/SupeemAFK/Quevo/pull/53) publishes this handoff.

## Engineering references

- [SRS](../requirements/srs.md), [feature inventory](../requirements/features.md), and [requirements traceability](../requirements/traceability.md)
- [System design and ER diagram](../design/system-sds.md), [UML sequences](../design/sprint-1-sequences.md), and [user journeys and ticket states](../requirements/workflows.md)
- [Three-sprint plan](plan.md), [effort weights and workflow labels](estimation.md), and [Kanban board](https://github.com/users/SupeemAFK/projects/14/views/1)

## Scope and acceptance

| Feature | Observable acceptance | Verification |
| --- | --- | --- |
| F-001 · Identity and permissions | Valid login creates a session. Invalid credentials and anonymous protected requests return 401. Customer requests to operator routes return 403. Logout revokes the session. | `TestAuthFlowWithPostgres`, `TestAuthRoutesEnforceSessionRoleAndOwnership`, and `tests/e2e/auth.spec.ts` |
| F-002–004 · Customer queue | A customer selects a service, receives a persisted WAITING ticket, and can recover it after reload. A duplicate active join returns 409 without changing the queue number. Another customer cannot read the ticket. | `TestCustomerQueueAPIWithPostgres` and `tests/e2e/customer-queue.spec.ts` |
| F-005–008 · Operator queue | Only assigned operators can access the queue. Calling next claims the oldest eligible ticket. The assigned operator can start, complete, or skip from the allowed state. Invalid transitions are rejected. | `TestOperatorQueueAPIWithPostgres`, `TestCallNextPreventsOperatorClaimingAcrossServices`, and the browser queue journey |
| F-009 · Persistence | Explicit migrations and demo seed are repeatable. PostgreSQL protects scoped numbers, active-ticket uniqueness, assignment, and state. | `TestMigrationsAndSeedAreIdempotent`, `TestConcurrentMigrationRunsAreSerialized`, and `TestQueueRepositoryPostgres` |

Acceptance uses synthetic accounts and an isolated PostgreSQL database. No future backlog features are needed to reproduce this release.

## Reproduce and inspect

Use the [README](../../README.md#quick-start) to build and start the clean stack, migrate, and seed. Stop that stack before running the automated suites and install the Playwright Chromium browser as described in the [test guide](../../README.md#test).

| Command or check | Recorded outcome at the submitted release |
| --- | --- |
| `docker compose build`, `docker compose up -d --wait db api web`, and the migration and seed commands | All three services started. The web and API returned HTTP 200. |
| `make test` | All five targets passed. Vitest passed 10 tests, Chromium passed 4 tests, and Go unit, integration, and provider checks passed. |
| From `apps/api`, `go test -json -count=1 ./...` and `go test -json -count=1 -tags=integration ./...` | 33 and 57 passing test or subtest events, respectively, with zero failures or skips. The integration run includes the standard tests. |
| [Main release CI and image builds](https://github.com/SupeemAFK/Quevo/actions/runs/43636901594/job/132575587196) | Both production images built. The first PR #51 CI attempt had two login timeouts. The [rerun](https://github.com/SupeemAFK/Quevo/actions/runs/43636320459/attempts/2) and the main release run passed. |
| Live local API rehearsal | Invalid login returned 401, valid login returned 200, a customer request to the operator queues returned 403, duplicate join returned 409, logout returned 204, and the revoked session returned 401. |

A retrospective replay of `TestAuthFlowWithPostgres` with the test from [`6fa825d`](https://github.com/SupeemAFK/Quevo/commit/6fa825d) failed on pre-fix code `aff056c` at the query-logging assertion and passed on the fixed commit. Both runs used Testcontainers PostgreSQL. The test and fix share a historical commit, so the replay proves the behavioral difference. The available history only partially documents test-first chronology across the sprint.

## Teammate review and contributions

| Work | Author | Teammate review |
| --- | --- | --- |
| [#7](https://github.com/SupeemAFK/Quevo/issues/7) · Sign-in and permissions | SupeemAFK | jarbbie verified timing and query-logging fixes in [PR #26](https://github.com/SupeemAFK/Quevo/pull/26#pullrequestreview-5813500327). |
| [#9](https://github.com/SupeemAFK/Quevo/issues/9) · Customer queue | SupeemAFK | jarbbie verified customer-scoped ticket recovery and the real-stack duplicate-join flow in [PR #27](https://github.com/SupeemAFK/Quevo/pull/27#pullrequestreview-5814580818). |
| [#12](https://github.com/SupeemAFK/Quevo/issues/12) · Operator queue | jarbbie | SupeemAFK reviewed [PR #28](https://github.com/SupeemAFK/Quevo/pull/28#pullrequestreview-5828672985) and recorded local verification limitations at review time. |
| [#15](https://github.com/SupeemAFK/Quevo/issues/15) · Persistence | jarbbie | SupeemAFK reviewed [PR #25](https://github.com/SupeemAFK/Quevo/pull/25). |

The feature PRs merged into staging. The [reviewed staging release #44](https://github.com/SupeemAFK/Quevo/pull/44#pullrequestreview-5904481158) entered main at `241193b`. The later PR #51 release at `82cd9c9` is the verified application revision used in the Sprint 1 report. Codex assisted with development, verification, evidence gathering, and report assembly. The linked PRs identify the team’s authors and reviewers.
