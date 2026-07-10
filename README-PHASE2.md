# CueBracket Pro — Phase 2

This patch adds:

- Dashboard page
- Tournament list/search/filter
- Create tournament form
- Open tournament details
- Start/complete status controls
- Duplicate and delete tournament
- Browser persistence using localStorage
- Responsive navigation and premium UI

## Install

Copy the `app`, `components`, and `lib` folders into your existing CueBracket project. Allow Windows to merge folders and replace `app/page.tsx`.

Then run:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Important

Phase 2 stores tournaments in the current browser only. The storage functions are isolated in `lib/tournaments.ts`, so Phase 5 can replace them with Supabase without rewriting the UI.
