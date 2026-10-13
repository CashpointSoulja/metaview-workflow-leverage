# design.md: Commercial Workflow Leverage Lab

Committed before app implementation. The design follows what I saw in the live `metaview.ai` pages (desktop 1366 px and mobile 390 px, inspected on 13 October 2026) without copying their screens, imagery, fonts or customer content. Authorship comes first; the company mark is contextual and secondary.

## 1. Authorship and marks

- Primary identity: **Commercial Workflow Leverage Lab**, with the byline **Independent concept by Ayo Ahmed** directly under it. Both sit at the top left in the header.
- Context label: a small "Concept for" chip on the right of the header holding the official Metaview wordmark (the inline SVG served on `metaview.ai`, unmodified apart from colour via `currentColor`). It is shown at 14 px tall, smaller than the Lab title, so it reads as context, not as the product owner.
- The non-affiliation notice is always visible in the header and footer: "Not affiliated with or endorsed by Metaview. All data is synthetic."
- No Metaview product screenshots, photography, illustrations, customer logos or testimonials anywhere.
- Links to Metaview go only to the home page (`https://www.metaview.ai/`), as the website terms of use require. See `research.md`.

## 2. What I observed (live pixels, not just CSS)

| Observation | Where | What the Lab does with it |
|---|---|---|
| Warm cream page background `#FBF8F4` with near-black text `#01051B` | All pages, from computed `body` style | Same two base tokens |
| Black pill buttons (`border-radius: 9999px`, white 500-weight label), with an outlined pill as the secondary | Header and hero CTAs | Primary actions are black pills; secondary actions are outlined pills |
| Floating, rounded, translucent nav bar that sticks on scroll | Desktop header after scroll | Sticky header with a 1 px hairline border and blur; not a copy of their nav content |
| Deep green panels `#0A2119` / `#000805` with mint `#7AFFB4` and lime-dark `#258B66` accents | "AI teammate" and case-study sections | A dark-green "verdict" band for decisions; mint is used only on dark backgrounds |
| Mint-to-white gradient wash behind pricing | Pricing page | A faint wash on the top of the page only |
| Monospace eyebrow labels in grey ("Pricing", "Why Metaview") | Section heads | Mono eyebrow above each section heading |
| White cards with a hairline `rgba(1,5,27,0.06)` border, 12-16 px radius, near-invisible layered shadow | Pricing cards, stat cards | Card component |
| Tight, heavy-ish geometric sans headings (500 weight, -0.03 to -0.04em tracking) | H1/H2 | Same scale and tracking with an open font |

## 3. Tokens

```
--bg:            #FBF8F4   page
--bg-accent:     #F7F1E9   inset panels
--surface:       #FFFFFF   cards
--text:          #01051B   body text (19.1:1 on --bg)
--text-muted:    #4A4D5E   secondary text (7.9:1 on --bg)  ← darker than the site's 56% alpha so it passes AA on cream
--hairline:      rgba(1,5,27,0.10)
--ink:           #000000   primary button
--green-deep:    #0A2119   verdict band
--green-ink:     #1C6B4F   success text on light (6.4:1 on #FFFFFF, 6.1:1 on --mint-wash)
--mint:          #7AFFB4   accent on dark only (13.5:1 on #0A2119)
--mint-wash:     #E3FFEF   success chip background
--amber-ink:     #8A4B00   hold/stale text (6.2:1 on #FFF4E0)
--amber-wash:    #FFF4E0
--red-ink:       #A3141B   blocked/abstain text (6.8:1 on #FFECEC)
--red-wash:      #FFECEC
--blue-ink:      #1238C9   links/focus (8.2:1 on --bg), from the site's `--mv-color-blue` family, darkened
--radius:        12px cards, 8px inputs, 999px pills
```

Every status pairs colour with a text label and an icon shape. Colour is never the only signal.

## 4. Type

- Metaview uses **Euclid Circular A** (proprietary) and **Onsite Mono** (proprietary). Neither is used or bundled.
- Open substitutes, self-hosted from `@fontsource` (SIL OFL 1.1): **Figtree** (geometric sans, the closest open match in width and x-height) and **IBM Plex Mono** for eyebrows, IDs, quotes and numbers.
- Scale: H1 44/1.0 at -0.04em, 500 · H2 30/1.05 at -0.03em, 500 · H3 20/1.2 at -0.02em, 600 · body 16/1.5 · small 14/1.45 · mono 13/1.45.
- At 390 px: H1 32, H2 24.

## 5. Layout

- Max content width 1288 px (the site's `--mv-ui-maxWidth`), 24 px gutters on mobile, 40 px on desktop.
- App shell: sticky header (title, byline, context chip), then a horizontal step bar: **1 Choose · 2 Build vs buy · 3 Handoff desk · 4 Effort · 5 Playbook & audit · Evals · Docs**. It is a real `<nav>` with links. On 390 px it scrolls horizontally with visible overflow hints, and the current step has `aria-current="page"`.
- Each step is one page: mono eyebrow, H2, a one-sentence "what this step decides", then the working surface.
- Desktop handoff desk: packet list (left, 320 px), packet detail (centre), evidence drawer (right). Below 1024 px it becomes a single column with the evidence shown inline under each field.

## 6. Components

- **Status chip**: pill, mono uppercase label plus icon: `READY` (mint wash, green ink, check), `HOLD` (amber, clock), `ABSTAIN` (red, slashed circle), `STALE` (amber, triangle), `UNKNOWN` (grey, question mark), `SIMULATED` (outlined, dashed border).
- **Evidence quote**: mono, left 3 px rule, source ID and date above. The exact matched span is marked with `<mark>`. Hostile or quarantined text renders as inert escaped text in a red-outlined block labelled "Quarantined: treated as data, not instructions".
- **Verdict band**: deep green background with mint and white text. Used once per page for the decision (ranking pick, build-vs-buy recommendation or "No recommendation", effort verdict).
- **Dialog**: native `<dialog>` with `showModal()`, focus moves to the first field, Esc closes, focus returns to the trigger. Used for assigning an owner, setting the adoption checkpoint, resolving a contradiction, approving, and import.
- **Table**: zebra-free, hairline row rules, numeric columns right-aligned in mono, a denominator column wherever there is a rate.
- **Synthetic banner**: a persistent strip under the header: "SYNTHETIC: every company, person, deal and number here is invented." It is never dismissible.

## 7. Accessibility bar

- WCAG 2.2 AA contrast for all text, including chips (ratios listed in §3).
- Everything works by keyboard: visible 2 px `--blue-ink` focus ring with 2 px offset, skip link, logical tab order, dialogs trap focus natively.
- `prefers-reduced-motion` disables all transitions.
- Live region (`aria-live="polite"`) announces command results ("Owner assigned. Revision 4.") and errors ("Rejected: revision 3 is stale, current is 4.").

## 8. What I deliberately did not copy

Metaview's hero photography, product UI mockups (candidate packs, charts, chat bubbles), animated orb, testimonial wall, customer logo strip, nav content, and copywriting. The Lab is an internal operations tool, so it looks like a calm work surface in the same visual language, not like a marketing site.
