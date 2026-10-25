import test from 'node:test';
import assert from 'node:assert/strict';
import {
  executeCommand
} from '../src/lib/tournament/commands.mjs';
import {
  publicData,
  playerView
} from '../src/lib/server/public.mjs';
import {
  standings
} from '../src/lib/tournament/standings.mjs';
import {
  snapshot,
  player,
  actor,
  now,
  round,
  game
} from './fixtures.mjs';
const opts = {
  now,
  draw: () => 3000
};
const execute = (s, action, input = {}, who = actor) => executeCommand(s, action, input, who, opts);
test('draft → published → running → closed with real timer and public visibility', () => {
  let s = snapshot([player(1), player(2), player(3)]);
  s.settings.tournament_state = 'check_in';
  s = execute(s, 'generate').state;
  assert.equal(s.rounds[0].status, 'draft');
  assert.equal(publicData(s, 'games').length, 0);
  assert.equal(playerView(s, 1).match, null);
  assert.throws(() => execute(s, 'generate'), /Close/);
  s = execute(s, 'publish', {
    id: 1
  }).state;
  assert.equal(publicData(s, 'games').length, 2);
  s = execute(s, 'start', {
    id: 1
  }).state;
  assert.equal(s.rounds[0].started_at, now);
  assert.throws(() => execute(s, 'close', {
    id: 1
  }), /every table/);
  const paired = s.games.find(g => g.black_id);
  s = execute(s, 'result', {
    id: paired.id,
    result: 'draw',
    is_forfeit: false
  }).state;
  s = execute(s, 'close', {
    id: 1
  }).state;
  assert.equal(s.rounds[0].status, 'closed');
});
test('publication locks seed ratings and player changes invalidate draft', () => {
  let s = snapshot([player(1), player(2)]);
  s.settings.tournament_state = 'check_in';
  s = execute(s, 'generate').state;
  const changed = execute(s, 'player_edit', {
    id: 1,
    patch: {
      seed_rating: 1300
    }
  }).state;
  assert.throws(() => execute(changed, 'publish', {
    id: 1
  }), /stale/);
  s = execute(s, 'publish', {
    id: 1
  }).state;
  assert.throws(() => execute(s, 'player_edit', {
    id: 1,
    patch: {
      seed_rating: 1300
    }
  }), /locked/);
});
test('withdrawal forfeits a running match without deleting history', () => {
  const s = snapshot([player(1), player(2)]);
  s.rounds = [round(1, {
    status: 'running',
    closed_at: null
  })];
  s.games = [game(1, 1, 1, 2, null)];
  const result = execute(s, 'player_edit', {
    id: 1,
    patch: {
      active: false
    }
  }).state;
  assert.equal(result.games[0].result, 'black');
  assert.equal(result.games[0].is_forfeit, true);
  assert.equal(result.players.length, 2);
  assert.equal(standings(result).find(p => p.id === 2).score, 1);
});
test('players with games cannot be deleted; only latest round can be deleted', () => {
  const s = snapshot([player(1), player(2)]);
  s.rounds = [round(1), round(2)];
  s.games = [game(1, 1, 1, 2, 'white')];
  assert.throws(() => execute(s, 'player_delete', {
    id: 1
  }), /Withdraw/);
  assert.throws(() => execute(s, 'round_delete', {
    id: 1
  }), /most recent/);
  assert.equal(execute(s, 'round_delete', {
    id: 2
  }).state.rounds.length, 1);
});
test('arbiter can enter running results but cannot edit players/closed results', () => {
  const who = {
      email: 'arbiter@example.test',
      role: 'arbiter'
    },
    s = snapshot([player(1), player(2)]);
  s.rounds = [round(1, {
    status: 'running'
  })];
  s.games = [game(1, 1, 1, 2, null)];
  assert.equal(execute(s, 'result', {
    id: 1,
    result: 'white'
  }, who).state.games[0].result, 'white');
  assert.throws(() => execute(s, 'player_edit', {
    id: 1,
    patch: {
      checked_in: false
    }
  }, who), /main admin/);
  s.rounds[0].status = 'closed';
  assert.throws(() => execute(s, 'result', {
    id: 1,
    result: 'black'
  }, who), /main admin/);
});
test('late forfeits wait ten minutes; prior-round correction requires reconciliation', () => {
  const s = snapshot([player(1), player(2)]);
  s.rounds = [round(1, {
    status: 'running'
  })];
  s.games = [game(1, 1, 1, 2, null)];
  assert.throws(() => execute(s, 'result', {
    id: 1,
    result: 'white',
    is_forfeit: true
  }), /period/);
  assert.equal(executeCommand(s, 'result', {
    id: 1,
    result: 'white',
    is_forfeit: true
  }, actor, {
    now: '2026-11-07T09:10:00Z'
  }).state.games[0].result, 'white');
  s.rounds[0].status = 'closed';
  s.rounds.push(round(2, {
    status: 'published'
  }));
  assert.throws(() => execute(s, 'result', {
    id: 1,
    result: 'black'
  }), /reconciliation/);
});
test('unauthenticated writes denied', () => {
  assert.throws(() => execute(snapshot(), 'settings', {}, null), /session/);
});

test('rating lock survives removal of the first published round', () => {
  let s = snapshot([player(1), player(2)]);
  s.settings.tournament_state = 'check_in';
  s = execute(s, 'generate').state;
  s = execute(s, 'publish', {
    id: 1
  }).state;
  s = execute(s, 'round_delete', {
    id: 1
  }).state;
  assert.equal(s.settings.ratings_locked, true);
  assert.throws(() => execute(s, 'player_edit', {
    id: 1,
    patch: {
      seed_rating: 1200
    }
  }), /locked/);
});
test('closed rounds cannot be cleared; annotations preserve result and finish time', () => {
  const s = snapshot([player(1), player(2)]);
  s.rounds = [round(1)];
  s.games = [game(1, 1, 1, 2, 'white', {
    notes: 'old',
    pgn: 'old'
  })];
  assert.throws(() => execute(s, 'result', {
    id: 1,
    result: null
  }), /unfinished/);
  const result = execute(s, 'result', {
    id: 1,
    notes: 'corrected',
    pgn: null
  }).state.games[0];
  assert.equal(result.result, 'white');
  assert.equal(result.finished_at, s.games[0].finished_at);
  assert.equal(result.pgn, null);
});

test('a Round 1 manual swap retains alternating higher-seed colours', () => {
  let s = snapshot(Array.from({
    length: 6
  }, (_, i) => player(i + 1)));
  s.settings.tournament_state = 'check_in';
  s = execute(s, 'generate').state;
  s = execute(s, 'swap', {
    id: 1,
    player_a: 1,
    player_b: 3
  }).state;
  assert.deepEqual(s.games.filter(g => g.black_id).map(g => g.white_id < g.black_id), [true, false,
    true
  ]);
  assert.equal(new Set(s.games.flatMap(g => [g.white_id, g.black_id])).size, 6);
});
