# CueBracket 0.9C — Format Engine Corrections

This patch corrects and polishes Round Robin, Swiss, Free For All, Groups → Finals, champion messaging and tournament completion controls.

## Installation

1. Stop the development server with `Ctrl + C`.
2. Extract this ZIP directly into `C:\project\cuebracket`.
3. Choose **Replace the files in the destination**.
4. Clear the Next.js cache and restart:

```powershell
cd C:\project\cuebracket
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run dev -- --webpack
```

No Supabase SQL change and no new npm package are required.

## Corrections included

### Round Robin and group tables

- Uses an explicit tiebreak order: points → head-to-head mini-table → head-to-head frame difference → overall frame difference → frames won → wins.
- Hides the draw column because CueBracket pool matches cannot finish level.
- Shows the exact tiebreak reason in the champion message.
- Replaces the incorrect double-elimination champion description.

### Swiss

- Replaces `Match 1000` with a dedicated **Automatic BYE** card.
- Adds a BYE column to Swiss standings.
- Separates played matches and BYEs in tournament statistics.
- Explains Buchholz and BYE scoring below the standings.
- Keeps rotating BYEs and repeat-opponent avoidance.
- Adds a Swiss-specific champion summary.

### Free For All

- Replaces the head-to-head table with: heats, heat wins, podiums, raw score, average finish and placement points.
- Uses a balanced deterministic scheduler that minimizes repeated opponents.
- Adds three tied-score rules:
  - Split occupied placement points — recommended and now the default.
  - Give all tied players full placement points.
  - Require a tiebreak score before saving.
- Uses **Score cap** instead of **Race to** on Free For All pages.
- Adds Free For All-specific ranking rules and champion messaging.

### Groups → Finals

- Corrects crossover seeding so two groups with two qualifiers produce:
  - Group A winner vs Group B runner-up.
  - Group B winner vs Group A runner-up.
- Generalizes the pairing rule for more groups while avoiding immediate same-group rematches whenever possible.
- Adds the bracket-reset setting to two-stage tournaments with double-elimination finals.

### Completed tournament controls and statistics

- Removes **Start Tournament** after completion.
- Adds **Reopen tournament** for corrections or result undoing.
- Average match duration now appears only when a match was explicitly started before its result was saved.
- Public views also separate played matches from BYEs.

## Existing tournament note

Existing saved results are not silently rearranged.

- To receive the new balanced Free For All heat schedule, reset that test competition and generate it again.
- A two-stage event whose final bracket was already generated keeps its existing pairings. Reset/recreate the test event before generating the final stage to test crossover seeding.
- Existing Round Robin or Swiss standings recalculate with the new tiebreak fields the next time a result is saved or undone.

## Regression checks completed

- Six-player Round Robin user test: Ben ranks first through the tied-player head-to-head mini-table.
- Seven-player, three-round Swiss: three different BYE recipients and no repeated opponents.
- Eight-player Free For All, four per heat, three rounds: no pair meets in all three rounds; tied first place splits 4 + 3 into 3.5 points each.
- Two groups, top two advancing: A1 vs B2 and B1 vs A2.
- Double-elimination Grand Final: a losers-bracket winner victory activates the reset, no champion is declared early, and the reset winner becomes champion.

Suggested commit message:

```text
CueBracket 0.9C - format engine corrections and tournament polish
```
