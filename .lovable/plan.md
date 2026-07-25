## Add a market data strip to the top bar

Show live **Nifty 50**, **Sensex**, and **USD → INR** in the app header so it's visible on every authenticated page (dashboard, pipeline, clients, etc.), not just one screen.

### Data source
Use a free, no-key API so nothing needs to be configured:
- **Yahoo Finance quote endpoint** (`^NSEI` for Nifty 50, `^BSESN` for Sensex, `USDINR=X` for the FX rate) — returns current price, previous close, and change.

Because Yahoo blocks direct browser calls (CORS), the fetch runs through a small **TanStack server route** at `src/routes/api/market-quotes.ts`. The route:
- Fetches the three symbols in parallel server-side.
- Returns a slim JSON payload: `{ nifty, sensex, usdinr }` each with `price`, `change`, `changePct`.
- Sets `Cache-Control: s-maxage=60` so we don't hammer the upstream.

### UI
New component `src/components/layout/market-ticker.tsx`:
- Three compact pills: label + price + colored delta (green up / red down, using existing semantic tokens — no hardcoded colors).
- Uses TanStack Query with `refetchInterval: 60_000` and `staleTime: 60_000`.
- Skeleton while loading; silently hidden if the upstream fails (no scary error in the header).
- Hidden on small screens (`hidden lg:flex`) so it doesn't crowd the mobile top bar.

Wired into `src/components/layout/top-bar.tsx` between `GlobalSearch` and the account menu.

### Caveats worth flagging
- Yahoo's unofficial endpoint isn't guaranteed stable. If it ever breaks, swap the server route to another free provider (e.g. Stooq) — the UI stays the same.
- Quotes are delayed ~15 min (standard for free feeds), not real-time tick data.
- Markets closed → values will simply show last close with a zero/near-zero delta.

No database or schema changes.
