import test from 'node:test';
import assert from 'node:assert/strict';
import {
  standings
} from '../src/lib/tournament/standings.mjs';
import {
  generatePairings,
  assertPairings
} from '../src/lib/tournament/pairing.mjs';
import {
  snapshot,
  player,
  round,
  game
} from './fixtures.mjs';
test('200 reproducible 60-player tournaments, six Swiss rounds each', {
  timeout: 600000
}, () => {
  let rematchRounds = 0,
    colourWarnings = 0,
    fallbacks = 0;
  const start = performance.now();
  for (let run = 1; run <= 200; run++) {
    let seed = run;
    const random = () => {
      seed = (1664525 * seed + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const s = snapshot(Array.from({
      length: 60
    }, (_, i) => player(i + 1, {
      seed_rating: 400 + Math.floor(random() * 1800)
    })));
    for (let r = 1; r <= 6; r++) {
      const players = standings(s),
        result = generatePairings(players);
      assertPairings(result.games, players);
      if (result.recovery) rematchRounds++;
      if (result.fallback) fallbacks++;
      let previous = null;
      for (const g of result.games) {
        if (g.black_id) {
          const a = players.find(p => p.id === g.white_id),
            b = players.find(p => p.id === g.black_id);
          if (a.opponents.includes(b.id)) assert(result.recovery, 'Rematch outside recovery');
          const key = [Math.max(a.score, b.score), a.score + b.score, a.seed_rating + b.seed_rating];
          if (previous) {
            const cmp = previous[0] - key[0] || previous[1] - key[1] || previous[2] - key[2];
            assert(cmp >= 0, 'Incorrect table order');
          }
          previous = key;
          for (const [p, c] of [
              [a, 'white'],
              [b, 'black']
            ])
            if (p.colour_history.at(-1) === c && p.colour_history.at(-2) === c) {
              colourWarnings++;
              assert.fail(`Third consecutive ${c} for ${p.full_name}`);
            }
        }
      }
      s.rounds.push(round(r));
      s.games.push(...result.games.map(g => game(s.games.length + g.table_number, r, g.white_id, g
        .black_id, random() < .15 ? 'draw' : random() < .5 ? 'white' : 'black', {
          table_number: g.table_number
        })));
      assert(standings(s).every(p => p.byes <= 1));
    }
  }
  console.log(JSON.stringify({
    runs: 200,
    rounds: 1200,
    rematchRounds,
    colourWarnings,
    fallbacks,
    duration_ms: Math.round(performance.now() - start)
  }));
});
