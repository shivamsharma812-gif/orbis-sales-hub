## Problem

Clicking a lead or client name navigates to `/leads/:id` (URL and title update correctly), but the page still shows the list. Cause: TanStack file-based routing treats `leads.tsx` + `leads.$id.tsx` as **parent + child** (same for clients). The list files render their own content but no `<Outlet />`, so child detail routes match but have nowhere to render — the parent's list UI stays on screen.

Confirmed in `src/routeTree.gen.ts`: `AuthenticatedLeadsRouteWithChildren` / `AuthenticatedClientsRouteWithChildren`.

## Fix

Convert the list routes into sibling index leaves so `/leads/$id` and `/clients/$id` are independent routes, not children of a layout.

1. Rename `src/routes/_authenticated/leads.tsx` → `src/routes/_authenticated/leads.index.tsx`, and update its `createFileRoute("/_authenticated/leads")` string to `"/_authenticated/leads/"`.
2. Rename `src/routes/_authenticated/clients.tsx` → `src/routes/_authenticated/clients.index.tsx`, and update its `createFileRoute("/_authenticated/clients")` to `"/_authenticated/clients/"`.
3. Let the TanStack Router plugin regenerate `src/routeTree.gen.ts` on the next dev run.

No component logic, queries, or links change. `<Link to="/leads/$id">` and `<Link to="/clients/$id">` continue to work.

## Verify

- Navigate to `/leads/<id>` — Lead Workspace renders (header, stage, tabs).
- Navigate to `/clients/<id>` — Client Workspace renders.
- `/leads` and `/clients` still render their lists.
