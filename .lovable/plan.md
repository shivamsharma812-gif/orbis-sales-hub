## Goal

Let system admins invite directory users who already exist in the Users table (but have no login yet) directly from the Users page — filling in only their **email** and **phone**, then sending the same Supabase invite email that new-user invites use.

## Current state (verified)

- `src/routes/_authenticated/users.tsx` shows a "Login: Not invited" badge for rows where `auth_user_id` is null, but has no action to invite them. Only `InviteUserDialog` (for brand-new employees) is exposed.
- `src/lib/admin.functions.ts` has `inviteUser` (creates a new `users` row + auth invite) and `resendInvite` (only works after a user already has `auth_user_id`).
- The seeded directory rows have placeholder `@orbis.demo` emails and no phone numbers, so we cannot just re-send — we must update contact info first, then invite.

## Changes

### 1. New server function `inviteExistingUser` in `src/lib/admin.functions.ts`

Input: `{ user_id, email, phone }`.

Behavior (admin-only, same `assertAdmin` guard):
- Load the `users` row by `user_id`; reject if `auth_user_id` is already set ("already invited").
- Reject if another `users` row already uses the new email.
- Update the row's `email` and `phone` with the provided values.
- Call `supabaseAdmin.auth.admin.inviteUserByEmail(email, { redirectTo: '<origin>/auth/set-password', data: { full_name } })`.
- Link the returned `auth.user.id` back onto the row's `auth_user_id`.
- Return `{ ok, error? }`.

### 2. New component `src/components/invite-directory-user-dialog.tsx`

Small dialog opened per-row. Props: `{ user: UserRow }`. Fields:
- **Email** (pre-filled with existing email if it looks real, blank if it's a `@orbis.demo` placeholder).
- **Phone** (pre-filled from row).

Zod-validated (email format, phone max length). Submit calls `inviteExistingUser` via `useServerFn` + `useMutation`, invalidates `["users-all"]`, toasts success/error.

### 3. Wire the action into `src/routes/_authenticated/users.tsx`

In the Admin actions cell, when `!u.auth_user_id`, render an "Invite to portal" button (Mail icon + label) that opens `InviteDirectoryUserDialog` for that row. Keep the existing re-send / grant-admin / deactivate buttons for already-invited rows unchanged.

## Out of scope

- Bulk selection / multi-invite (single-row action only for now).
- Demo-account cleanup (user said they'll handle later).
- Custom-branded invite email (still uses Supabase default sender, same as today).

## Technical notes

- No schema change; `users.email` and `users.phone` already exist and are editable by admins under existing RLS via the service-role client.
- Uses the same `redirectTo: /auth/set-password` flow as `inviteUser`, so recipients land on the existing set-password page.
