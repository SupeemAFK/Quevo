# Authenticated application shell

The customer queue, customer ticket, and operator queue render inside a shared authenticated shell. Its navigation links only to the queue for the signed-in role. The customer ticket route keeps the customer queue link visible so customers can return to their own queue.

The shell displays the signed-in identity on wider screens, provides a skip link to the main content, and keeps sign-out available on every authenticated route. Sign-out calls the existing server function, removes the customer and operator query state, and navigates to the public home route. Authentication checks, role checks, cookies, and API contracts stay in the route guards and existing server functions.

`apps/web/src/components/authenticated-shell.test.tsx` verifies customer/operator destinations, current-route semantics, query cleanup, sign-out navigation, and failure announcements. Playwright covers a signed-in customer deep link, queue return, operator queue, and sign-out.
