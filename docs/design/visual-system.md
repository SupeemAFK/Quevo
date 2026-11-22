# Quevo visual system

Quevo uses a black-and-white interface with a restrained green accent. The page should read clearly before motion: typography, alignment, and neutral borders establish hierarchy. Green identifies a selected service and meaningful active or successful states. Primary actions use neutral black and white.

## Theme tokens

The tokens in `apps/web/src/styles.css` are semantic and switch with Light, Dark, or System preference. System follows `prefers-color-scheme`; an explicit choice is stored in `localStorage` and applied before the page paints.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| Background | `#FFFFFF` | `#111111` | Page canvas |
| Surface | `#FAFAFA` | `#1C1C1C` | Bounded content and controls |
| Foreground | `#111111` | `#FAFAFA` | Headings and primary copy |
| Muted text | `#737373` | `#A3A3A3` | Supporting copy and metadata |
| Border | `#E5E5E5` | `#333333` | Dividers and control outlines |
| Green accent | `#16803C` | `#4ADE80` | Selected service and active/success status |
| Primary action | `#111111` | `#FAFAFA` | Primary controls |
| Primary action text | `#FFFFFF` | `#111111` | Text on primary controls |

The navigation theme control uses three labeled icon buttons: System (monitor), Light (sun), and Dark (moon). The selected choice is visibly pressed, the choice persists, and all options remain keyboard accessible.

The web foundation remains shadcn/ui, Tailwind CSS, Geist Sans and Geist Mono, Motion for React, and Lucide. Do not add another component or animation library for visual polish.

## Component rules

- Use white/black and neutral grays for page structure. Use neutral layering only where it clarifies the product preview. Avoid generic decorative backgrounds, gradients, and glows. Landing and sign-in queue artwork may use low-contrast route lines and ticket slips across the canvas to reinforce the product's sense of ordered movement; keep it behind content and preserve text contrast.
- Reserve green for selected service, activity markers, and meaningful active/success states. Primary controls stay black/white. Do not color headline text green.
- Use plain text for metadata. Ticket statuses may use a neutral outline with a visible text label.
- Use bounded surfaces only where they improve focus, such as the queue preview, ticket, form, or operator current-ticket area.
- Keep controls keyboard accessible, use visible focus, and keep primary touch targets at least 44px tall.
- Use Geist Mono for ticket identifiers and queue ordinals.
- Customer queue position and estimated wait time are unavailable from the API and must not be derived from ticket numbers.

## Ticket states

| API state | Label | Treatment |
| --- | --- | --- |
| `WAITING` | Waiting | Neutral |
| `PENDING` | Called | Green text, label retained |
| `OPERATING` | In service | Green text, label retained |
| `COMPLETED` | Completed | Green text, label retained |
| `SKIPPED` | Skipped | Neutral |

Error and warning colors are reserved for those semantic messages. Ticket transitions and authorization remain owned by the API.

## Motion

Use Motion where it explains an interaction: the landing role switch, selected service/queue, ticket status, queue reordering, animated counts, or short control/feedback transitions. Keep actions immediate. Landing and sign-in route markers and ticket slips may move subtly to reinforce queue progression; keep them behind content and respect reduced motion. Landing content reveals as its section enters view. Status text remains visible immediately while its icon transitions. The landing preview is a local interactive sample; it cycles through the same three tickets, can be paused, and does not read or change a real queue. Playback is disabled when reduced motion is requested.

## Contrast

The required color pairs meet WCAG AA for normal text:

| Pair | Contrast |
| --- | ---: |
| `#111111` on `#FFFFFF` | 18.88:1 |
| White text on `#111111` | 18.88:1 |
| `#111111` text on `#FAFAFA` | 18.09:1 |
| `#737373` on `#FFFFFF` | 4.74:1 |
| `#16803C` on `#FFFFFF` | 5.02:1 |
| `#FAFAFA` on `#111111` | 18.09:1 |
| `#A3A3A3` on `#111111` | 7.49:1 |
| `#4ADE80` on `#111111` | 10.84:1 |
| `#111111` button text on `#4ADE80` | 10.84:1 |

Keep status meaning available in text and pair asynchronous errors with alert semantics.
