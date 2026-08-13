# Fix: users get logged out after a few minutes

## What's actually happening

Session storage itself is fine (long-lived refresh token in the browser, auto-refreshed). The logouts come from the demo-account bootstrapper.

Every time *anyone* submits the sign-in form, the app calls `/api/public/bootstrap-demo-users` first. That endpoint loops over all six demo accounts and **resets each one's password** with the admin API — on every single sign-in attempt, even when the accounts already exist and are already linked.

Changing a user's password in the auth service revokes that user's existing refresh tokens. So the moment a colleague opens the sign-in page and signs in, everyone else's stored session can no longer refresh. It keeps working until the next token refresh (~within the hour, sooner on tab focus or a reload), and then the app bounces them to `/auth`. That reads exactly as "logged out after a few minutes".

A second, smaller contributor: the auth gate treats *any* error from the "who am I" check as "not signed in" and redirects to `/auth`. A transient network blip during that call logs the user out visually even though the session is still valid.

## The fix

1. **Stop resetting passwords on every sign-in.**
   - Make the bootstrap endpoint truly idempotent: create + link accounts only when missing, never call the password-update path for accounts that already exist and are linked.
   - Stop calling it on every sign-in from the sign-in form. Only attempt it once (guarded), or only when a sign-in fails with "invalid credentials" — so normal sign-ins never touch the auth admin API.

2. **Make the auth gate fault-tolerant.**
   - Redirect to `/auth` only when there is genuinely no session. If the identity check fails for a network/transient reason while a stored session still exists, keep the user in the app instead of signing them out.

3. **Tidy the sign-in page hydration warning** (the page currently renders differently on server vs browser, producing a console error on `/auth`). Harmless today, but worth clearing while touching this file.

## Technical notes

- Files touched: `src/routes/api/public/bootstrap-demo-users.ts`, `src/routes/auth.tsx`, `src/routes/_authenticated/route.tsx`.
- No database or schema changes.
- No change to token lifetimes; once the password churn stops, sessions persist normally and refresh silently.

## Optional follow-up (not included unless you want it)

Remove the demo bootstrapper entirely and manage real users through the existing "Invite to portal" admin flow. That eliminates the shared demo password and the admin-API path from a public endpoint altogether.
