## Why this is happening

The invite link in the email is a Supabase `/auth/v1/verify?...&redirect_to=...` URL. After Supabase verifies the token, it redirects the user to `redirect_to` — **but only if that URL is in the project's allowed Redirect URLs**. Otherwise Supabase falls back to the project's **Site URL**, which is currently pointing at the default Lovable URL, so users land on the Lovable login screen instead of `/auth/set-password` in this app.

On top of that, our invite code builds the redirect from env vars that aren't reliably set:

```ts
const origin =
  process.env.PUBLIC_APP_URL ??
  `https://project--${process.env.SUPABASE_PROJECT_ID ?? ""}.lovable.app`;
```

`PUBLIC_APP_URL` isn't defined and `SUPABASE_PROJECT_ID` isn't the Lovable project ID, so the fallback string is malformed. Even when Supabase's allowlist is right, we're handing it a broken `redirectTo`.

## Fix

1. **Use the correct stable app URL as the redirect base.** Lovable exposes stable URLs derived from the Lovable project id (`project--{id}.lovable.app` for production, `project--{id}-dev.lovable.app` for preview). Hardcode these into a small helper in `src/lib/admin.functions.ts` (production URL by default, preview URL when running against the preview environment). Remove the `PUBLIC_APP_URL` / `SUPABASE_PROJECT_ID` guesswork.

2. **Send the invite `redirectTo` to `${appUrl}/auth/set-password`** from all three call sites (`inviteUser`, `inviteExistingUser`, `resendInvite`).

3. **Register the app URLs in Supabase Auth** so the redirect is honored and the Site URL no longer points to Lovable's default:
   - Site URL → the published/preview app URL
   - Additional Redirect URLs → `${appUrl}/auth/set-password`, `${appUrl}/auth`, plus the custom domain when you add one later

4. **Verify** by sending a fresh invite to a test address and confirming the email link lands on this app's `/auth/set-password` page (not Lovable's login).

## Notes for later

- When you connect a custom domain, add it to the Supabase Auth allowlist too and switch the helper's base URL to it, otherwise invites will keep pointing at the `lovable.app` URL.
- Old invite emails already sent will still contain the old broken redirect — resend them after the fix.
