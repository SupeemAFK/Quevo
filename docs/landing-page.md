# Public landing page

The `/` route introduces Quevo to visitors and keeps the existing `/login` conversion path. Signed-in visitors see a direct link to the queue for their role and retain the sign-out action.

## Sections and navigation

- `#top` is the product hero.
- `#queue-demo` is a local interactive walkthrough.
- `#workflows` describes the customer and operator steps and ticket lifecycle.
- The closing action links to `/login`; footer links return to those page sections.

The mobile navigation button exposes its expanded state and controls the same section links as the desktop header. A skip link takes keyboard users directly to the main content. Use native anchors for sections and TanStack links for application routes.

## Demo data boundary

The queue demo creates three fixed sample tickets in React component state. Call, serve, and reset actions do not call the API, read a user session, persist data, or alter a branch queue. It labels the data as a sample, announces each state change, and disables actions when their next transition is unavailable. Motion uses the user's reduced-motion preference; the text and controls remain usable without animation.

## Product claims

The page describes the implemented Sprint 1 flow: customers choose an active service, join, and view their ticket; operators work assigned queues, call the next waiting ticket, start service, then complete or skip. It does not promise cancellation, no-show handling, automatic updates, multiple counters, queue administration, summaries, public queue displays, signup, or live customer data.

## Verification

`tests/e2e/home.spec.ts` checks page metadata, section copy, the sample ticket lifecycle, no API calls from the demo, skip-link and mobile-menu keyboard operation, reduced-motion operation, and layout widths of 320, 375, 768, and 1280 CSS pixels. Component tests cover the menu's expanded state and the demo's call, serve, empty, and reset states. Check the accessibility tree and perform a screen-reader pass during release review; the route has one page heading, named navigation landmarks, labeled queue sections, and a polite announcement for each demo action.
