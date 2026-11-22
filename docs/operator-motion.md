# Operator queue motion

Operator queue movement follows API-backed query updates. The UI does not optimistically move or reorder tickets: successful actions refresh the server-owned queue, then Motion animates the resulting current-ticket and waiting-list layout. Failed actions do not animate a local state change; the follow-up refresh still reconciles the display if another operator changed the server queue.

The implementation reuses the existing Motion for React dependency. Shared layout IDs connect a ticket row to the current-ticket panel after Call Next, while short list and empty-state transitions clarify confirmed updates. Starting, completing, and skipping keep their status text and action feedback visible throughout.

`MotionConfig` respects the operating-system reduced-motion preference and `useReducedMotion` removes layout and fade transitions for that preference. Ticket text, state labels, and actions remain available. See [Motion's reduced-motion guidance](https://motion.dev/docs/react-accessibility).

## Validation

- Component tests cover reduced-motion content, pending states, and unchanged API-provided queue data after a failed action.
- The `customer-queue.spec.ts` Playwright flow checks all operator actions with normal motion and repeats the action lifecycle with reduced motion enabled.
- The browser test requires the Docker-backed E2E setup; see [the development guide](development.md#end-to-end-tests).
