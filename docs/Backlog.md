# Backlog

Updated: 2026-02-18
Source: Client feedback

## P0 — Fix Blog route/navigation

### Item
- Blog page is reported as not working.

### Scope
- Verify top navigation `Blog` target and Ghost route mapping.
- Confirm `/blog/` collection renders posts correctly.
- Ensure links from cards and categories/tags still work.

### Acceptance Criteria
- `Blog` in header opens the all-articles listing page.
- Listing page loads published posts without error.
- No broken links in blog cards and pagination.

---

## P1 — Markets page: add TradingView widgets in this exact order

Client-requested order (from TradingView widgets catalog):
1. Market Overview (keep existing)
2. Economic Calendar
3. Forex Heatmap
4. Forex Cross Rates
5. Screener (only Major, Minor, Exotics — not all)
6. Economic Map
7. Stock Heatmap
8. ETF Heatmap

### Scope
- Implement widgets on Markets page in the requested sequence.
- Keep existing site visual style (dark card aesthetic, spacing, typography, borders).
- Maintain responsive layout and acceptable load performance.

### Acceptance Criteria
- All 8 widgets render on Markets page in exact order.
- Screener includes only the 3 requested groups.
- Layout is visually consistent with current theme aesthetic.
- No JS errors in browser console during widget load.

---

## P2 — Theme color switching system (from reference)

Reference behavior: https://skalven.hedwik.io/readings/

Requested theme options:
- Light
- Dark
- Warm (rename from Dune)
- Forest (rename from Matrix)
- Sun (rename from Royal)

### Scope
- Add user-facing theme switcher with the 5 options above.
- Persist selected theme (localStorage).
- Apply across core pages/components (header, footer, cards, content, widgets container backgrounds where possible).

### Acceptance Criteria
- User can switch among all 5 themes.
- Selected theme persists after page reload.
- Labels use `Warm`, `Forest`, `Sun` (no `Dune/Matrix/Royal` labels visible).
- Contrast/readability remains acceptable across key pages.

---

## Open Questions Before Implementation

1. **Blog issue detail**: what exactly fails now (404, blank page, wrong page, or no posts)?
2. **Markets layout**: should the 8 widgets be stacked vertically on one page, or grouped in sections/tabs?
3. **Screener source**: confirm if this means Forex screener with only Major/Minor/Exotics groups.
4. **Theme switcher placement**: where should the switcher live (header, footer, or account area)?

---

## Proposed Implementation Order
1. P0 Blog fix
2. P1 Markets widget expansion
3. P2 Theme switching system
