# Capture "Why lead was lost?" reason

## Schema

Migration adds two nullable columns to `public.leads`:
- `lost_reason` (text) — free-text explanation
- `lost_at` (timestamptz) — when it was marked lost

## UI

Update `src/routes/_authenticated/leads.$id.tsx`:
- Replace the plain "Mark lost" button with one that opens a small confirmation Dialog containing a required Textarea ("Why was this lead lost?").
- On confirm, the `markLost` mutation now writes `status='lost'`, `pipeline_stage='Lost'`, `lost_reason=<text>`, `lost_at=now()`.
- Show the saved reason on the Overview tab when `status === 'lost'` (labelled "Lost reason", with the date), placed near the top so it's visible immediately.
- When a lead is revived, clear `lost_reason` and `lost_at` in the `revive` mutation so a future loss captures a fresh reason.

## Not changed

- Lost-leads list filter, delete flow, and other tabs are untouched.
- No changes to clients or other tables.
