# Authentication Contract

This document records the implementation choices for issue #7. The auth API uses the `users` and `sessions` tables created by versioned migrations. The follow-up migration renames the initial `app_users` table and its generic credential fields without losing existing records.

## Identity and session storage

The API uses the following PostgreSQL tables, created by the versioned migration and idempotent demo seed.

| Table | Field | Type/meaning |
| --- | --- | --- |
| `users` | `id` | UUID primary key |
| `users` | `role` | `CUSTOMER` or `OPERATOR` |
| `users` | `display_name` | Name returned by `/auth/me` |
| `users` | `email` | Unique email; lookup trims whitespace and ignores case |
| `users` | `password_hash` | bcrypt password hash; plaintext passwords are never stored |
| `sessions` | `id` | UUID primary key |
| `sessions` | `user_id` | UUID foreign key to `users.id` |
| `sessions` | `token_hash` | Unique SHA-256 hash of the opaque session token |
| `sessions` | `created_at`, `expires_at` | UTC session timestamps |
| `sessions` | `revoked_at` | Nullable UTC revocation timestamp |
| `operator_services` | `operator_id`, `service_id` | Composite primary key linking an operator to an authorized service |

Session tokens contain 256 bits of cryptographic randomness. The API persists only their SHA-256 hashes. Session lifetime defaults to 12 hours and can be changed with `SESSION_TTL`; the API returns the expiry time so the web cookie uses the same lifetime.

## API and browser boundary

All API paths are under `/api/v1`:

| Operation | Request/response | Access |
| --- | --- | --- |
| `POST /auth/login` | `{ "email", "password" }`; returns `{ "user", "sessionToken", "expiresAt" }` to the web server | Public |
| `GET /auth/me` | Returns `{ "user": { "id", "displayName", "role" } }` | Active bearer session |
| `POST /auth/logout` | Returns `204`; revokes the bearer session | Active bearer session |

The API token is passed from the TanStack Start server function to Go in the `Authorization: Bearer` header. The web server stores it in the `quevo_session` cookie with `HttpOnly`, `SameSite=Lax`, `Path=/`, and `Secure` in production. The token is never returned by a web server function to browser JavaScript.

TanStack Start server functions are the only browser-to-API path. Login and logout use POST server functions; Start's request-origin checks protect those calls against cross-site requests. The Go API still enforces sessions and roles, so hiding a UI action is not treated as authorization.

Authentication failures use the shared safe error shape `{ "code", "message", "requestId" }`. Unknown emails and incorrect passwords have the same `401` response. Missing, expired, or revoked sessions return `401`; authenticated users with a wrong role or service assignment receive `403`. Queue handlers should use `RequireOperatorService` with the route's `serviceID` parameter. Customer ticket endpoints must scope their repository read to the authenticated customer and return `404` for another customer's ticket.

## Local readiness

The login UI and auth API are implemented. For local login, start PostgreSQL, run `make migrate-up`, then `make seed-demo` from `apps/api` with `QUEVO_CUSTOMER_PASSWORD` and `QUEVO_OPERATOR_PASSWORD` set. The health check remains usable when PostgreSQL is unavailable; database-backed auth requests return safe errors.
