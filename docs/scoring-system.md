# En Passant #3 scoring rules

Production source: `src/lib/tournament/standings.mjs`, `model.mjs`, and `pairing.mjs`. All participant and admin views use the same standings calculation.

Completed Swiss games award win 1, draw 0.5, loss 0. A solo bye awards 1 and adds no opponent, colour history, or played-game count. A forfeit awards 1–0 to the recorded winner, retains the real opponent, and is not an allocated bye. A double forfeit awards 0–0. Unfinished, draft, knockout, and Armageddon games add no Swiss points. Corrections recalculate from history.

Standings order is score, Buchholz, direct encounter, fewer actual byes, then recorded Armageddon resolution. Buchholz sums each real opponent’s current Swiss score for each completed meeting; a recovery rematch contributes again. Withdrawn opponents remain included. A multi-player direct-encounter mini-league applies only when every tied player has played every other tied player. Otherwise it does not separate that group.

Unresolved ties share a competition rank (1=, 1=, 3). Higher seed then lower ID control display order only. Armageddon White has 5 minutes, Black 4, and Black wins a draw. Its recorded outcome changes tie order, never Swiss points; stale resolutions are ignored after the underlying Swiss results change.

Only active, checked-in players are paired. The bye goes first to the minimum-bye group, then lower score, Buchholz, seed, and ID. Round 1 defaults to closest ratings and alternates the higher seed’s colour by table. Subsequent rounds use score brackets, floaters, a six-candidate backtracking search, and an explicit rematch recovery pass. Full colour history and cumulative imbalance determine colour need. Weighted Blossom matching supplies the timeout fallback and resolves avoidable forced-colour conflicts through float repair. Every saved draft must include each eligible player exactly once.

See `third-edition-setup.md` for migration, permission, timing, correction, and verification procedures.
