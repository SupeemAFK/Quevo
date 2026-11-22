# Web UI design system

## Direction

Quevo uses a quiet off-white and charcoal foundation with a clear blue action color. This keeps queue data easy to scan and gives primary actions an identifiable treatment without relying on decorative imagery. The existing Geist Variable font, Tailwind CSS v4, and shadcn component setup remain the only typography and component systems.

The existing neutral palette was retained as the base and refined: the page background is slightly warm (`#fcfcfb`), body text remains charcoal (`#1f2937`), borders are dark enough to identify controls (`#d1d5db`), and the neutral primary action was changed to blue (`#1d4ed8`). The existing dark theme remains supported. Color is always paired with a readable label or other state cue.

## Semantic tokens

Tokens are defined in `apps/web/src/styles.css` and mapped into Tailwind utilities.

| Purpose | Token | Use |
| --- | --- | --- |
| Page and content | `background`, `foreground`, `card`, `muted` | Page surfaces, text, grouped content |
| Action | `primary`, `primary-foreground`, `secondary`, `secondary-foreground` | Main and supporting actions |
| Feedback | `status-success`, `status-warning`, `status-info`, `status-danger` and matching `*-surface` | Queue states and inline feedback; keep status words visible |
| Focus and boundaries | `ring`, `border`, `input`, `destructive` | Keyboard focus, separators, fields, and errors |
| Type | `font-sans`, `text-display`, `text-section` | Geist Variable and responsive heading sizes |
| Space and width | `spacing-page`, `spacing-section`, `spacing-content` | Responsive page gutters, section rhythm, and content width |
| Corners | `radius-sm`, `radius-md`, `radius-lg`, `radius-xl` | Component corners derived from the shared 12px base |

Use utilities such as `text-status-success`, `bg-status-success-surface`, `px-page`, `py-section`, and `max-w-content` instead of adding page-specific color or spacing values. Use `text-destructive` and `role="alert"` for errors; informational and success copy should use the matching status token plus plain text.

The landing page adds a restrained mint accent and blue and violet surface tokens (`--landing-mint`, `--landing-mint-surface`, `--landing-blue-surface`, and `--landing-violet-surface`) for its sample queue illustration. Keep these accents on the public landing page; queue state continues to use the shared status tokens.

## Motion

Use the existing `motion` package for short entrance, in-view, and state-change transitions. The root route transition and public landing animations use `MotionConfig` with `reducedMotion="user"`; CSS-only decorative animation must also stop under `prefers-reduced-motion`. Keep hover movement subtle and preserve the existing visible focus rings and minimum touch targets.

## Contrast and focus

The foreground/background pairs below were checked against WCAG 2.2 relative luminance. Small text meets the 4.5:1 AA target; the focus ring meets the 3:1 non-text contrast target against the page and card surfaces.

| Pair | Light | Dark |
| --- | ---: | ---: |
| Body text on page | `#1f2937` / `#fcfcfb` — 14.3:1 | `#f9fafb` / `#111827` — 17.0:1 |
| Muted text on card | `#4b5563` / `#ffffff` — 7.6:1 | `#d1d5db` / `#1f2937` — 10.0:1 |
| Primary action label | `#ffffff` / `#1d4ed8` — 6.7:1 | `#0f172a` / `#93c5fd` — 9.9:1 |
| Success status | `#166534` / `#f0fdf4` — 6.8:1 | `#86efac` / `#123a22` — 9.0:1 |
| Warning status | `#92400e` / `#fffbeb` — 6.8:1 | `#fcd34d` / `#422006` — 10.1:1 |
| Information status | `#1d4ed8` / `#eff6ff` — 6.2:1 | `#93c5fd` / `#172554` — 8.2:1 |
| Danger status | `#b42318` / `#fef3f2` — 6.1:1 | `#fda29b` / `#55160c` — 7.2:1 |

The focus ring is `#2563eb` on light surfaces (5.0:1 against the page and 5.2:1 against cards) and `#93c5fd` on dark surfaces (9.8:1 against the page and 8.1:1 against cards).

Interactive controls use a solid, 2px `ring` outline with offset. Keep the visible outline in custom controls and do not use a color-only state. The status text remains present when status color is applied.

## Component patterns

- Prefer the existing shadcn `Button` variants and semantic classes.
- Keep loading, empty, error, and success feedback close to the action or data it describes.
- Use a minimum 44px touch area for new primary controls and give links a visible keyboard focus state.
- Keep page content within the shared content width and use the responsive page and section spacing tokens.
