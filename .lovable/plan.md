# Fix: users get logged out after a few minutes

## Confirmed cause

Session storage is fine — the browser holds a long-lived refresh token and renews the access token automatically. The logouts come from the demo-account bootstrapper.

Every submission of the sign-in form first calls `/api/public/bootstrap-demo-users`. That endpoint loops over all six demo accounts and **resets each password** through the admin API, even when the accounts already exist and are already linked. The backend auth log shows exactly this: six `user_modified` admin calls in one second from the live site, one per demo account, on a single sign-in.

Changing a password revokes that user's existing refresh tokens. So whenever anyone opens the app and signs in, everyone else's stored session stops being renewable. It keeps working until the next refresh attempt (tab focus, reload, or the hourly refresh) and then the app bounces them to `/auth` — "logged out after a few minutes".

Secondary contributor: the auth gate treats *any* failure of the identity check as "not signed in" and redirects. A transient network blip therefore signs a user out visually even with a valid session.

## The fix

1. **Stop the password churn.**
   - Make the bootstrap endpoint truly idempotent: create and link an account only when it is missing. Never run the password-update path for accounts already created and linked.
   - Stop calling it on every sign-in. The sign-in form will only fall back to it when a sign-in actually fails with invalid credentials, so ordinary sign-ins never reach the auth admin API.

2. **Make the auth gate fault-tolerant.**
   - Redirect to `/auth` only when there is genuinely no stored session. If the identity check fails for a transient/network reason while a session exists, keep the user in the app.

3. **Clear the sign-in page hydration mismatch** that currently logs an error on `/auth` (server and client render different trees). Harmless today, but it lives in the same file.

Demo accounts stay for now — this only removes the destructive reset, so demo logins keep working.

## Technical notes

- Files: `src/routes/api/public/bootstrap-demo-users.ts`, `src/routes/auth.tsx`, `src/routes/_authenticated/route.tsx`.
- No database or schema changes; no change to token lifetimes.
- Existing sessions already revoked will need one more sign-in; after that they persist.

## Follow-up worth doing later

Retire the shared demo password and the public bootstrap endpoint entirely, onboarding everyone through the existing admin "Invite to portal" flow.
