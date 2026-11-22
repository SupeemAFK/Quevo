# Web accessibility audit

This audit records the keyboard, focus, feedback, theme, motion, contrast, and narrow-screen checks covered by the current web implementation. Shared color pairings and component rules are documented in the [minimal black-and-white visual system](design/visual-system.md#contrast).

## Findings addressed

- Client-side route changes move focus to the new page's level-one heading. Initial page load leaves focus at the browser start so the skip link remains the first keyboard stop.
- The landing page's skip link and in-page navigation targets can receive focus. Its mobile navigation closes on Escape and returns focus to its trigger; choosing a section moves focus to that section.
- Login fields, queue actions, and primary buttons have at least a 44px target height. Interactive controls retain visible keyboard focus.
- A single customer service is preselected without an extra control. Multiple services use native radio inputs with visible selected text; operator service switching uses a native mobile select and labeled desktop buttons when more than one queue is assigned.
- Ticket and queue states retain text labels. Color is supplementary. Ordered operator tickets expose their position in the list to assistive technology.
- The Light/Dark/System selector has an accessible label, persists an explicit choice, and defaults to the operating system preference.
- Pending work is announced as status feedback. Errors use alert semantics. In-flight actions disable controls and guard repeat submission.
- Operator and customer ticket transitions follow server-confirmed state and respect the operating system's reduced-motion preference.
- Customer and operator pages are exercised at 320px with a horizontal overflow assertion.

## Keyboard walkthrough

The Playwright suite exercises key flows with focus and key presses:

1. Open `/login`; Tab from the document start through Email, Password, and Sign in. Submit with Enter.
2. Open the mobile navigation with Enter, activate the role-specific application link with Enter, and confirm focus moves to the destination heading.
3. With one service, join directly using Enter. With multiple services, choose a service with the radio controls before joining. Open an active ticket and refresh its status with Enter.
4. In the operator queue, call the next customer, start service, and complete or skip service using Enter. Confirm focus follows each successful action to the next valid action or the empty-queue message.
5. Change the theme to Light, Dark, and System. Reload with an explicit theme and confirm the stored preference is applied.
6. Repeat operator actions with `prefers-reduced-motion: reduce` enabled.
7. Check the customer and operator layouts at 320px and confirm there is no horizontal page overflow.

These checks are maintained in `tests/e2e/auth.spec.ts`, `tests/e2e/home.spec.ts`, and `tests/e2e/customer-queue.spec.ts`. Component tests cover multiple-service keyboard controls; the default E2E seed contains one customer service and one operator queue. Automated checks do not replace a screen-reader review with target assistive technologies.

## Verification

Run web lint and type checks from `apps/web`:

```sh
bun run lint
bun run typecheck
```

Run component, integration, and browser tests using the repository's [test prerequisites and commands](../README.md#test). The complete browser path uses the local Compose services and Playwright Chromium.
