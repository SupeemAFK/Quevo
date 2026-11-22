# Public landing page

The `/` route introduces Quevo with a single sign-in action and a secondary link to its interactive sample. Signed-in visitors see a link to the queue for their role and retain sign-out.

## Layout

- `#top` pairs the value statement and two clear actions with a layered queue preview and a short three-step path from choosing a service to being called.
- `#queue-demo` is the only demonstration. Its animated customer/operator switch shows the same sample tickets as a digital ticket or an operator queue. Counts, ticket changes, status, and ordered rows respond to the local controls; sample state stays in local React state. The sample cycles continuously on load, offers pause/replay, and stays still for reduced-motion preferences.
- `#workflows` explains the customer and operator steps with small queue-specific interface snippets, staggered reveals, and a moving ticket-progress marker.
- The header and footer link to the workflow explanation and sample, with a sign-in action.

The page follows the black-and-white system in [the visual system](design/visual-system.md). Green marks active or successful states; primary controls use neutral black and white. Lucide icons label meaningful roles and actions. Typography, dividers, a short sequence rail, and one layered product preview establish the visual hierarchy. Theme preference is a compact System/Light/Dark icon group with persistent selection. Section links scroll smoothly unless reduced motion is preferred.

The mobile navigation supports keyboard operation and the page provides a skip link. Native anchors handle page sections; TanStack links handle application routes.

## Demo data boundary

The queue preview starts with three labeled sample tickets in React component state. Call, serve, and reset actions do not call the API, read a user session, persist data, or alter a branch queue. Each action is announced, unavailable transitions are disabled, and queue updates use short Motion transitions that respect reduced motion.

## Product claims

The page describes the implemented Sprint 1 flow: customers choose an active service, join, and view their ticket; operators work assigned queues, call the next waiting ticket, start service, then complete or skip. It does not promise cancellation, no-show handling, automatic updates, multiple counters, queue administration, summaries, public queue displays, signup, or live customer data.

## Verification

`tests/e2e/home.spec.ts` checks page metadata, the hero queue preview, the customer/operator switch, theme preference control, no API calls from the sample demo, keyboard operation, reduced-motion behavior, and layout widths of 320, 375, 768, and 1280 CSS pixels. Component tests cover the menu and the demo's role-specific ticket state, call, serve, empty, and reset states. Screen-reader review with target assistive technologies remains part of release review.
