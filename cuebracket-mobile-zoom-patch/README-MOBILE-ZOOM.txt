CueBracket 0.9E - Mobile Bracket Navigation, Patch 1

Changed file:
  components/BracketViewport.tsx

What this patch adds:
- Two-finger pinch-to-zoom on phones and tablets
- Zoom range from 25% to 200%
- One-finger bracket panning in every direction
- Vertical gesture handoff to the webpage when the bracket reaches its top/bottom edge
- Larger 44px touch-friendly zoom controls
- Fit-to-screen button
- Ctrl/trackpad pinch zoom support on desktop
- Correct scaled canvas dimensions to reduce empty or unreachable bracket space
- Same behavior for organizer and public spectator brackets because both use BracketViewport

Install:
1. Stop the dev server.
2. Extract this ZIP into C:\project\cuebracket
3. Replace the existing file when Windows asks.
4. Run:
   Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
   npm run build
5. If build passes, run npm run dev and test on a phone.

Phone test:
- Use one finger to move left, right, up and down inside the bracket.
- Pinch two fingers inward until 25%.
- Pinch outward up to 200%.
- Tap Fit to fit the whole bracket width.
- At the top or bottom of the bracket, keep swiping vertically and confirm the main page continues scrolling.
- Confirm score buttons and inputs still work.
