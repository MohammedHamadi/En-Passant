import test from 'node:test';
import assert from 'node:assert/strict';
import {
  standings
} from '../src/lib/tournament/standings.mjs';
import {
  generatePairings,
  colourNeed,
  assignColours,
  penalty,
  assertPairings
} from '../src/lib/tournament/pairing.mjs';
import {
  DEFAULT_SETTINGS
} from '../src/lib/tournament/model.mjs';
import {
  snapshot,
  player,
  round,
  game
} from './fixtures.mjs';
const pool = n => standings(snapshot(Array.from({
  length: n
}, (_, i) => player(i + 1))));
test('60 even and 61 odd eligible players all paired exactly once', () => {
  for (const n of [60, 61]) {
    const p = pool(n),
      r = generatePairings(p);
    assertPairings(r.games, p);
    assert.equal(r.games.length, Math.ceil(n / 2));
  }
});
test('inactive and unchecked-in players excluded', () => {
  const p = pool(4);
  p[0].active = false;
  p[1].checked_in = false;
  assert.equal(generatePairings(p).games.length, 1);
});
test('minimum byes first, then lowest score/Buchholz/seed/ID', () => {
  const p = pool(3);
  p[2].byes = 1;
  p[0].score = 1;
  assert.equal(generatePairings(p).games.find(g => !g.black_id).white_id, p[1].id);
});
test('float before avoidable rematch', () => {
  const p = pool(4);
  p[0].score = p[1].score = 1;
  p[0].history = [{}];
  p[0].opponents = [2];
  p[1].opponents = [1];
  const r = generatePairings(p);
  assert(!r.games.some(g => g.white_id + g.black_id === 3));
  assert.equal(r.recovery, false);
});
test('forced rematch appears only with recovery warning', () => {
  const p = pool(2);
  p[0].history = [{}];
  p[0].opponents = [2];
  p[1].opponents = [1];
  const r = generatePairings(p);
  assert.equal(r.recovery, true);
  assert(r.warnings.some(w => w.includes('Rematch')));
});
test('forced timeout invokes weighted perfect matching fallback', () => {
  const p = pool(60),
    r = generatePairings(p, DEFAULT_SETTINGS, {
      timeoutMs: 0
    });
  assert.equal(r.fallback, true);
  assertPairings(r.games, p);
});
test('Round 1 pairs close seeds, alternates higher-seed colours, persists table order', () => {
  const p = pool(6),
    r = generatePairings(p);
  assert.deepEqual(r.games.map(g => [g.white_id, g.black_id, g.table_number]), [
    [1, 2, 1],
    [4, 3, 2],
    [5, 6, 3]
  ]);
});
test('optional top-half Round 1 method', () => {
  const r = generatePairings(pool(6), {
    ...DEFAULT_SETTINGS,
    round1_method: 'top_half'
  });
  assert.deepEqual(r.games.map(g => [g.white_id, g.black_id]), [
    [1, 4],
    [5, 2],
    [3, 6]
  ]);
});
test('full colour imbalance and streak determine need', () => {
  assert.equal(colourNeed({
    colour_history: ['white', 'white', 'black', 'white', 'black', 'white']
  }).strength, 2);
  assert.deepEqual(colourNeed({
    colour_history: []
  }), {
    colour: null,
    strength: 0,
    imbalance: 0
  });
});
test('higher seed receives preferred colour when need equal', () => {
  const p = pool(2);
  p.forEach(p => p.colour_history = ['white']);
  assert.equal(assignColours(p[0], p[1]).black.id, p[0].id);
});
test('exact colour and score-gap penalties', () => {
  const p = pool(2);
  p[1].seed_rating = p[0].seed_rating;
  p.forEach(p => p.colour_history = ['white', 'white']);
  assert.equal(penalty(...p), 500);
  p[1].colour_history = ['white'];
  assert.equal(penalty(...p), 60);
  p[0].colour_history = ['white'];
  assert.equal(penalty(...p), 20);
  p[1].colour_history = ['black'];
  p[1].score = 1;
  assert.equal(penalty(...p), 30);
});
test('duplicate players or missing byes fail integrity check', () => {
  assert.throws(() => assertPairings([{
    white_id: 1,
    black_id: 1
  }], pool(2)), /exactly once/);
});

test('Blossom timeout fallback reaches the minimum permitted total weight', () => {
  const p = pool(6);
  p.forEach((player, i) => {
    player.seed_rating = 700 + i * i * 70;
    player.score = i % 3;
    player.history = [{}];
    player.colour_history = i % 2 ? ['black'] : ['white'];
  });
  p[0].opponents = [2];
  p[1].opponents = [1];

  function optimum(players) {
    if (!players.length) return 0;
    const [a, ...rest] = players;
    return Math.min(...rest.filter(b => !a.opponents.includes(b.id) && !b.opponents.includes(a.id)).map(
      b => penalty(a, b) + optimum(rest.filter(q => q.id !== b.id))));
  }
  const r = generatePairings(p, DEFAULT_SETTINGS, {
      timeoutMs: 0
    }),
    byId = new Map(p.map(q => [q.id, q]));
  const actual = r.games.reduce((sum, g) => sum + penalty(byId.get(g.white_id), byId.get(g.black_id)), 0);
  assert.equal(r.fallback, true);
  assert.equal(r.recovery, false);
  assert.equal(actual, optimum(p));
});
