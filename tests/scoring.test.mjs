import test from 'node:test';
import assert from 'node:assert/strict';
import {
  standings
} from '../src/lib/tournament/standings.mjs';
import {
  tieContext
} from '../src/lib/tournament/model.mjs';
import {
  snapshot,
  player,
  round,
  game
} from './fixtures.mjs';
for (const [result, expected] of [
    ['white', [1, 0]],
    ['black', [0, 1]],
    ['draw', [.5, .5]],
    ['double_forfeit', [0, 0]],
    [null, [0, 0]]
  ]) test(`Swiss points: ${result}`, () => {
  const s = snapshot([player(1), player(2)]);
  s.rounds = [round(1)];
  s.games = [game(1, 1, 1, 2, result)];
  const rows = new Map(standings(s).map(p => [p.id, p]));
  assert.deepEqual([rows.get(1).score, rows.get(2).score], expected);
});
test('bye gives one point, no played game, opponent, colour or Buchholz', () => {
  const s = snapshot([player(1)]);
  s.rounds = [round(1)];
  s.games = [game(1, 1, 1, null, 'bye')];
  const p = standings(s)[0];
  assert.deepEqual([p.score, p.byes, p.games, p.buchholz, p.opponents, p.colour_history], [1, 1, 0, 0, [],
    []
  ]);
});
test('forfeit is a real opponent, not a bye', () => {
  const s = snapshot([player(1), player(2)]);
  s.rounds = [round(1)];
  s.games = [game(1, 1, 1, 2, 'white', {
    is_forfeit: true
  })];
  const rows = standings(s);
  assert.equal(rows[0].score, 1);
  assert.equal(rows[0].byes, 0);
  assert.equal(rows[1].buchholz, 1);
});
test('corrections and reverting to pending recalculate from history', () => {
  const s = snapshot([player(1), player(2)]);
  s.rounds = [round(1)];
  s.games = [game(1, 1, 1, 2, 'white')];
  assert.equal(standings(s).find(p => p.id === 1).score, 1);
  s.games[0].result = 'black';
  assert.equal(standings(s).find(p => p.id === 1).score, 0);
  s.games[0].result = null;
  assert(standings(s).every(p => p.score === 0 && p.games === 0));
});
test('knockout, Armageddon and draft games do not add Swiss points', () => {
  const s = snapshot([player(1), player(2)]);
  s.rounds = [round(1, {
    stage: 'knockout'
  }), round(2, {
    status: 'draft'
  }), round(3)];
  s.games = [game(1, 1, 1, 2, 'white', {
    kind: 'knockout'
  }), game(2, 2, 1, 2, 'white'), game(3, 3, 1, 2, 'white', {
    kind: 'armageddon'
  })];
  assert(standings(s).every(p => p.score === 0));
});
test('Buchholz precedes fewer byes', () => {
  const s = snapshot([player(1), player(2), player(3), player(4), player(5)]);
  s.rounds = [round(1), round(2)];
  s.games = [game(1, 1, 1, null, 'bye'), game(2, 1, 2, 5, 'white'), game(3, 1, 3, 4, 'white'), game(4, 2,
    1, 2, 'black'), game(5, 2, 3, 5, 'black')];
  const rows = standings(s);
  assert.equal(rows.find(p => p.id === 1).score, 1);
  assert.equal(rows.find(p => p.id === 3).score, 1);
  assert(rows.find(p => p.id === 1).buchholz > rows.find(p => p.id === 3).buchholz);
  assert(rows.findIndex(p => p.id === 1) < rows.findIndex(p => p.id === 3));
});
test('head-to-head beats higher seed when score/Buchholz equal', () => {
  const s = snapshot([player(1, {
    seed_rating: 2200
  }), player(2, {
    seed_rating: 1200
  }), player(3)]);
  s.rounds = [round(1), round(2)];
  s.games = [game(1, 1, 1, 2, 'black'), game(2, 2, 1, 3, 'white')];
  assert.deepEqual(standings(s).map(p => p.id), [2, 1, 3]);
});
test('three-player complete mini-league is used', () => {
  const s = snapshot([player(1), player(2), player(3)]);
  s.rounds = [round(1), round(2), round(3)];
  s.games = [game(1, 1, 1, 2, 'white'), game(2, 2, 2, 3, 'white'), game(3, 3, 3, 1, 'white')];
  const rows = standings(s);
  assert(rows.every(p => p.direct_encounter === 1 && p.rank === 1 && p.tie));
});
test('incomplete tied mini-league does not invent a separation', () => {
  const s = snapshot([player(3), player(2), player(1)]);
  assert(standings(s).every(p => p.rank === 1 && p.tie && p.direct_encounter === 0));
});
test('equal seeds use lower ID for display, retain shared ranks and withdrawn players', () => {
  const s = snapshot([player(2, {
    seed_rating: 1000,
    active: false
  }), player(1, {
    seed_rating: 1000
  })]);
  assert.deepEqual(standings(s).map(p => [p.id, p.rank, p.tie]), [
    [1, 1, true],
    [2, 1, true]
  ]);
  assert.equal(standings(s)[1].status, 'withdrawn');
});
test('Armageddon draw ranks Black higher without Swiss points; stale context ignored', () => {
  const s = snapshot([player(1), player(2)]);
  s.rounds = [round(1)];
  s.games = [game(1, 1, 1, 2, 'draw')];
  s.games.push(game(2, 1, 1, 2, 'draw', {
    kind: 'armageddon',
    table_number: null,
    tie_context: tieContext(s)
  }));
  assert.deepEqual(standings(s).map(p => [p.id, p.score, p.rank]), [
    [2, .5, 1],
    [1, .5, 2]
  ]);
  s.games[0].result = 'white';
  assert.equal(standings(s)[0].id, 1);
});
test('recovery rematches contribute once per completed meeting', () => {
  const s = snapshot([player(1), player(2)]);
  s.rounds = [round(1), round(2)];
  s.games = [game(1, 1, 1, 2, 'draw'), game(2, 2, 1, 2, 'draw')];
  assert(standings(s).every(p => p.buchholz === 2));
});

test('direct encounter precedes fewer byes', () => {
  const s = snapshot([player(1), player(2), player(3), player(4)]);
  s.rounds = [round(1), round(2), round(3)];
  s.games = [game(1, 1, 1, 2, 'white'), game(2, 2, 1, null, 'bye'), game(3, 2, 2, 3, 'white'), game(4, 3,
    2, 4, 'white')];
  const rows = standings(s);
  assert.equal(rows[0].id, 1);
  assert.equal(rows[0].score, rows[1].score);
  assert.equal(rows[0].buchholz, rows[1].buchholz);
  assert.equal(rows[0].byes, 1);
});
test('fewer byes resolves an otherwise unresolved tie', () => {
  const s = snapshot([player(1), player(2), player(3)]);
  s.rounds = [round(1)];
  s.games = [game(1, 1, 1, null, 'bye'), game(2, 1, 2, 3, 'white')];
  const rows = standings(s);
  assert.equal(rows[0].id, 2);
  assert.equal(rows[0].tie, false);
  assert.equal(rows[1].id, 1);
});
