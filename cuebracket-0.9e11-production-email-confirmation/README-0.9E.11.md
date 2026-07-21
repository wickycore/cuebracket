# CueBracket 0.9E.11 — Production Email Confirmation

This patch replaces:

- `components/AuthForm.tsx`
- `app/auth/callback/route.ts`

It makes production signups use `NEXT_PUBLIC_SITE_URL`, keeps localhost working during development, validates callback redirect paths, and handles Vercel forwarding safely.

## Required configuration

In Vercel, set:

`NEXT_PUBLIC_SITE_URL=https://cuebracket-doaa.vercel.app`

Apply it to Production, Preview, and Development, then redeploy.

In Supabase > Authentication > URL Configuration:

Site URL:
`https://cuebracket-doaa.vercel.app`

Redirect URLs:
- `https://cuebracket-doaa.vercel.app/auth/callback`
- `https://cuebracket-doaa.vercel.app/**`
- `http://localhost:3000/auth/callback`
- `http://localhost:3000/**`

Previously sent confirmation emails keep their old redirect. Create a fresh test account or resend the confirmation email after changing these settings.
