## Goal
Prevent the NIFTY / SENSEX / USD-INR / Gold / Silver ticker pills from wrapping to a second row on the dashboard.

## Current state
- `src/components/layout/market-ticker.tsx` renders pills in `flex flex-wrap items-center gap-2`, so they wrap when horizontal space is tight.
- The ticker sits inside a `Card` at the top of `src/routes/_authenticated/dashboard.tsx`.

## Changes
1. **MarketTicker component**
   - Change the root container from `flex flex-wrap` to `flex flex-nowrap items-center gap-2`.
   - Add `overflow-x-auto` and a subtle scrollbar-hide utility so the row scrolls horizontally on very narrow viewports instead of wrapping.
   - Slightly reduce pill horizontal padding (`px-2` instead of `px-2.5`) to help everything fit on a typical desktop screen.

2. **Dashboard card**
   - Ensure the parent `Card` does not constrain the ticker width in a way that forces wrapping; keep it full-width inside the `p-6` content area.

## Verification
- Open `/dashboard` and confirm all five ticker items sit on one line.
- Resize to a narrow viewport and confirm horizontal scroll behavior (no wrap).

No backend or data changes are required.