# Workflow feedback patterns

The login, customer queue, ticket detail, and operator queue use shared inline feedback components. `FeedbackMessage` pairs success/error icons with visible copy, gives success messages a polite `status` role and failures an assertive `alert` role, and enters with a short reduced-motion-aware transition. `LoadingMessage` provides one polite status region and a small spinner for loading and in-progress actions. The components intentionally do not add an explicit `aria-live` attribute because those roles already provide live-region behavior.

Keep messages next to the control or content they describe. Retain domain-specific wording for sign-in failures, duplicate joins, stale or unavailable tickets, and API authorization errors. Where retry is possible, keep a nearby retry or refresh control. Success feedback remains visible until the next action or navigation so it is not dismissed before the user can read it.

Do not add a toast library solely for these workflow messages. A toast should only be considered for future feedback that has no useful inline location.

## Validation

- Component tests assert that success and loading use one `status` region and failures use an `alert` region.
- Login, customer, ticket, and operator tests cover their domain messages and relevant controls.
- The customer/operator Playwright flow checks success announcements through real authenticated actions.
