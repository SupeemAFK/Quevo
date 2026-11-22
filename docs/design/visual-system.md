# Quevo visual system

Quevo uses **Ink & Vermilion** across public and authenticated screens. Use spacing and typography to organize the interface; keep surfaces flat and use vermilion for the brand, a selected control, or a meaningful progress indicator.

## Core tokens

| Token | Value | Use |
| --- | --- | --- |
| Background | `#F7F6F2` | App canvas |
| Surface | `#FFFFFF` | Forms, queue panels, and interactive demo |
| Primary text | `#20201E` | Headings, body copy, primary controls |
| Secondary text | `#66645F` | Supporting copy and metadata |
| Border | `#DCDAD4` | Dividers, outlines, and control boundaries |
| Brand accent | `#E34B35` | Quevo mark, large headline emphasis, selected borders, and progress |
| Primary button | `#20201E` / `#FFFFFF` | Ink background with white label |

Tokens live in `apps/web/src/styles.css` and map to the existing shadcn/ui theme variables. Functional controls stay in shadcn/ui; page composition uses Tailwind; meaningful state transitions use Motion for React; icons use Lucide. Geist Variable is the UI font. Geist Mono is used for ticket identifiers and numbered queue sequences.

## Component rules

- Use warm neutral backgrounds and white surfaces. Do not use translucent colored fills, decorative gradients, glows, background grids, or ornamental rings.
- Reserve vermilion for recognizable brand moments and selected or progressing states. Use ink or muted text for small labels so text contrast remains accessible.
- Render generic metadata such as “Sample data” as muted text or a subtle outline. Render ticket statuses with their label and a clear outline; semantic text color may reinforce the state but does not replace the label.
- Keep cards for bounded interactive content, such as a ticket, form, queue, or demo. Describe editorial sections with spacing, rules, and type rather than putting every section in a card.
- Use `rounded-md` or `rounded-lg` for controls and panels. Avoid unnecessary elevation and motion. Respect `prefers-reduced-motion` and keep focus indicators visible with sufficient contrast.

## Status colors

Waiting and called use accessible blue text; in-service uses amber; completed uses green; skipped and unknown states use muted neutral text. Each state remains written out in the interface, so color is supplementary.
