## Changes

### 1. Move market ticker to dashboard only
- Remove `<MarketTicker />` from `src/components/layout/top-bar.tsx`.
- Render `<MarketTicker />` at the top of `src/routes/_authenticated/dashboard.tsx` (above the KPI row), visible at all widths.

### 2. Share leads down the hierarchy
Add a per-lead "share with team" toggle so an owner can make a specific lead visible (read-only) to their descendants.

**DB migration:**
- Add `leads.shared_with_team boolean not null default false`.
- Update `leads` SELECT policy to also allow reads when `shared_with_team = true` AND the current user is a descendant of `owner_id` (via `is_descendant_of(owner_id, current_app_user_id())`).
- Keep UPDATE/DELETE/INSERT policies unchanged — sharing grants view only, not edit.

**UI (`src/routes/_authenticated/leads.$id.tsx`):**
- Add a "Share with my team" toggle button in the header actions, visible only to the lead's owner (or the owner's managers).
- Toggling flips `shared_with_team` and invalidates the lead query. Show current state ("Shared with team" / "Share with team").

Clients are unchanged (only leads, per request).

### 3. Remove Industry field from lead & client views
- `src/routes/_authenticated/leads.$id.tsx`: remove the Industry row from the Overview panel.
- `src/routes/_authenticated/clients.$id.tsx`: remove the Industry row from the Overview panel.
- Leave the DB column alone (data preserved, just hidden).

## Files touched
- `src/components/layout/top-bar.tsx`
- `src/routes/_authenticated/dashboard.tsx`
- `src/routes/_authenticated/leads.$id.tsx`
- `src/routes/_authenticated/clients.$id.tsx`
- New migration: add `shared_with_team` column + updated SELECT policy on `leads`
