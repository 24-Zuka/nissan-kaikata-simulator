# Design QA

- source visual truth path: `/Users/nishidzukakai/Downloads/日産比較シミュレーター デザイン仕様書.dc.html`
- implementation screenshot path: `tmp/design-qa/nissan-red-presentation-1440.png`
- additional implementation states: `tmp/design-qa/nissan-red-input-1440.png`, `tmp/design-qa/nissan-red-input-dark-1440.png`, `tmp/design-qa/nissan-red-login-dark-1440.png`, `tmp/design-qa/nissan-red-presentation-834.png`, `tmp/design-qa/nissan-red-presentation-390.png`
- viewport: 1440x1000, 834x1112, 390x844
- state: authenticated input/presentation, signed-out login, light/dark
- full-view comparison evidence: unavailable; the selected in-app Browser rejected direct access to the local source HTML under its URL safety policy
- focused region comparison evidence: unavailable for the same source-capture blocker

## Findings

- [P1] Source-to-implementation visual comparison is blocked
  - Location: whole application.
  - Evidence: the implementation screenshots were captured successfully at all required viewports and states, but the source HTML could not be opened by the selected browser. The source contains no embedded raster reference image that can be compared independently.
  - Impact: token and layout compliance can be checked from source code and the approved plan, but pixel-level visual fidelity cannot be certified.
  - Fix: open the source HTML in the in-app Browser or provide a screenshot of the specification at the target viewport, then create a combined comparison image and rerun this QA.

## Verified Implementation Surfaces

- Fonts and typography: system font stack and tabular/monospace numerals are applied; Japanese headings and labels do not clip at the tested widths.
- Spacing and layout: 1120px desktop width, 900px layout switch, compact sticky results, 44px controls, and responsive header wrapping were visually checked.
- Colors and tokens: light, dark, Nissan Red, success, warning, error, focus, selected, and disabled states are present with text/border cues.
- Image quality: the provided N mark geometry is reused as SVG and regenerated at 192px and 512px; no placeholder icon is used.
- Copy and content: login, detail input, plan comparison, maturity treatment, insurance state, and maintenance burden labels are coherent Japanese.
- Accessibility and behavior: no horizontal overflow at 1440px, 834px, or 390px; theme switch exposes switch state; focus rings and reduced-motion handling remain enabled.
- Print structure: the screen row table and print column table are separate; print CSS forces light monochrome A4 landscape and hides chart/controls.

## Patches Made

- Added Nissan Red tokens, semantic status colors, red focus/selection states, and light/dark surfaces.
- Rebuilt the brand mark, login card, theme switch, header sync status, toolbar, compact quick results, and responsive header.
- Added the screen-only plan-row comparison table while preserving the print-only plan-column table.
- Changed the cost chart to vertical bars on desktop and horizontal bars on mobile.
- Updated SVG/PNG PWA icons, manifest colors, and dynamic theme colors.
- Fixed desktop title wrapping and tablet/mobile header grid issues found during browser QA.

## Implementation Checklist

- Capture the source design in the selected browser.
- Build a same-viewport combined comparison image.
- Resolve any visible P0-P2 differences and update this report to passed.

final result: blocked
