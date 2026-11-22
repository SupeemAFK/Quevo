# Web accessibility audit

This audit records the keyboard, focus, feedback, motion, and narrow-screen checks covered by the current web implementation. The shared color contrast measurements and token rules are in the [UI design system](ui-design-system.md#contrast-and-focus).

## Findings addressed

- Client-side route changes move focus to the new page's level-one heading. Initial page load leaves focus at the browser start so the skip link remains the first keyboard stop.
- The landing page's skip link and in-page navigation targets can receive focus. The mobile navigation closes on Escape and returns focus to its trigger; choosing a section moves focus to that section.
- Login fields, queue actions, and primary buttons have at least a 44 px target height. Interactive controls retain a visible keyboard focus ring.
- Queue selection exposes its selected state with `aria-pressed` and visible text. Ticket and queue states include text labels; color is supplementary.
- Pending work is announced as status feedback. Errors use alert semantics. Actions that are pending stay in keyboard order and guard duplicate submissions.
- Operator motion follows confirmed query results and respects the operating system's reduced-motion preference. The queue remains usable when motion is reduced.
- The customer and operator pages are exercised at a 320 px viewport, with a horizontal overflow assertion.

## Keyboard walkthrough

The Playwright suite exercises this path with keyboard focus and key presses for the key actions:

1. Open `/login`; Tab from the document start through Email, Password, and Sign in. Submit with Enter.
2. Open the mobile navigation with Enter, activate the role-specific application link with Enter, and confirm focus moves to the destination heading.
3. In the customer queue, select a service with Space, join with Enter, and refresh ticket status with Enter.
4. In the operator queue, call the next customer, start service, and complete or skip service using Enter. Confirm focus follows each successful action to the next valid action or the empty-current-ticket message.
5. Repeat operator actions with `prefers-reduced-motion: reduce` enabled.
6. Check the customer and operator layouts at 320 px and confirm there is no horizontal page overflow.

These checks are maintained in `tests/e2e/auth.spec.ts`, `tests/e2e/home.spec.ts`, and `tests/e2e/customer-queue.spec.ts`. The first-party automated checks do not replace a screen-reader review with the target assistive technologies.

## Verification

Run the web lint and type checks from `apps/web`:

```sh
bun run lint
bun run typecheck
```

Run component, integration, and browser tests using the repository's [test prerequisites and commands](../README.md#test). The complete browser path uses the local Compose services and Playwright Chromium.
