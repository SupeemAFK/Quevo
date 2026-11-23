# Queue motion

Queue movement follows API-backed query updates. The operator UI does not optimistically move or reorder tickets: successful actions refresh server-owned data, then Motion animates the resulting current-ticket and waiting-list layout. Failed actions do not animate a local state change; the follow-up refresh reconciles the display if another operator changed the queue.

The existing Motion for React dependency also provides a short customer ticket status transition after a successful manual refresh. The customer ticket page continues to communicate that updates are manual. Button press feedback is brief and does not delay actions.

The landing role switch transfers its selected background between Customer and Operator. Customer service selections and operator queue navigation respond to hover and press, while operator waiting counts and status icons acknowledge confirmed changes. Feedback enters briefly; queue controls use small loading indicators during requests. Lucide labels and status text stay present if animation is reduced.

`MotionConfig` respects the operating system's reduced-motion preference. Reduced motion removes layout and fade movement while leaving ticket text, status labels, and actions immediately available. See [Motion's reduced-motion guidance](https://motion.dev/docs/react-accessibility).

## Validation

- Component tests cover reduced-motion content, pending states, status guidance, and unchanged API-provided queue state after a failed action.
- The `customer-queue.spec.ts` Playwright flow checks the operator lifecycle with normal motion, repeats it with reduced motion enabled, and checks the 320px customer and operator layouts.
- The browser test requires the Docker-backed E2E setup; see the [development guide](development.md#end-to-end-tests).
