# CueBracket 0.9F.1 — Mobile Foundation

This patch is built for the current mobile screenshots and replaces:

- `app/page.tsx`
- `app/layout.tsx`
- `app/globals.css`
- `app/auth/signup/page.tsx`
- `app/auth/login/page.tsx`
- `components/AppHeader.tsx`
- `components/AuthForm.tsx`

## Main improvements

- Removes the large empty gaps on the mobile homepage.
- Places the live control-room preview immediately after the hero.
- Uses one-column cards on narrow phones instead of cramped two-column cards.
- Reduces the total mobile page length while preserving all key content.
- Enlarges the header, menu and touch targets.
- Adds safe-area support and prevents accidental sideways scrolling.
- Makes signup and login top-aligned, full-width and readable on phones.
- Uses 16px mobile inputs to prevent automatic browser zoom.
- Preserves the production Supabase confirmation redirect through `NEXT_PUBLIC_SITE_URL`.
- Adds proper metadata and removes the default "Create Next App" title.
- Removes the Next.js smooth-scroll warning.

No SQL or new npm packages are required.
