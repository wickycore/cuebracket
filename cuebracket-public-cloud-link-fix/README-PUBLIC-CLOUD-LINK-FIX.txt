CueBracket public cloud link fix

Problem:
The share component generated /live/{id}. That route read localStorage, so another device could not find the tournament.

Fix:
- New share links use /cloud/live/{id}.
- Old /live/{id} links automatically redirect to /cloud/live/{id}.

Install:
1. Stop the dev server.
2. Extract this ZIP into C:\project\cuebracket.
3. Replace files when Windows asks.
4. Run:
   Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
   npm run build
5. Commit and push to GitHub so Vercel redeploys.
