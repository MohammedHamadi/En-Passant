import test from 'node:test';
import assert from 'node:assert/strict';
import {
  randomInt
} from 'node:crypto';
import {
  previewImport,
  parseCSV
} from '../src/lib/tournament/player-import.mjs';
import {
  seedRating,
  uniqueCode,
  DEFAULT_SETTINGS,
  publicSettings
} from '../src/lib/tournament/model.mjs';
import {
  executeCommand
} from '../src/lib/tournament/commands.mjs';
import {
  MemoryRepository,
  mutate
} from '../src/lib/server/repository.mjs';
import {
  publicData,
  playerView
} from '../src/lib/server/public.mjs';
import {
  snapshot,
  player,
  actor,
  now,
  round,
  game
} from './fixtures.mjs';
const options = {
  now,
  draw: () => randomInt(1000, 10000)
};
test('legacy name/elo and full_name/rating CSVs both work', () => {
  for (const headers of ['name,elo', 'full_name,rating', 'Full Name,Seed Rating']) {
    const result = previewImport(snapshot(), headers + '\nExample Player,1600');
    assert.equal(result.can_import, true);
    assert.equal(result.rows[0].player.seed_rating, 1600);
  }
});
test('UTF-8 BOM, quoted commas, quotes, newlines and CRLF are parsed', () => {
  assert.deepEqual(parseCSV('\uFEFFname,elo\r\n"Alice, \"\"Ace\"\"\nExample",1200\r\n'), [
    ['name', 'elo'],
    ['Alice, "Ace"\nExample', '1200']
  ]);
});
test('invalid CSV structure is rejected', () => {
  for (const csv of ['name,elo\n"unfinished,1200', 'name,full_name\nA,B', 'rating\n1200']) assert.throws(
  () => previewImport(snapshot(), csv));
});
test('preview validates every row without changing the roster', () => {
  const state = snapshot(),
    preview = previewImport(state, 'name,elo\nGood,1200\nBad,not-a-number');
  assert.equal(preview.summary.added, 1);
  assert.equal(preview.summary.invalid, 1);
  assert.equal(preview.can_import, false);
  assert.equal(state.players.length, 0);
});
test('invalid rows abort the entire upload', async () => {
  const repo = new MemoryRepository(snapshot());
  await assert.rejects(mutate(repo, 'player_import', {
    csv: 'name,elo\nGood,1200\nBad,9000'
  }, actor, options), /Row 3/);
  assert.equal(repo.state.players.length, 0);
  assert.equal(repo.audit.length, 0);
});
test('repeat uploads skip duplicates and preserve existing score/history', async () => {
  const state = snapshot([player(1, {
    external_id: 'source-1'
  })]);
  state.rounds = [round(1)];
  state.games = [game(1, 1, 1, null, 'bye')];
  const repo = new MemoryRepository(state),
    result = await mutate(repo, 'player_import', {
      csv: 'external_id,name,elo\nsource-1,Changed Name,2000\nsource-2,New Player,1400'
    }, actor, options);
  assert.equal(result.added, 1);
  assert.equal(result.skipped, 1);
  assert.equal(repo.state.players[0].full_name, 'Player 1');
  assert.deepEqual(repo.state.games, state.games);
});
test('same-named players can be distinguished by external IDs', () => {
  const result = previewImport(snapshot(),
    'id,name,elo\nexternal-A,Same Name,1200\nexternal-B,Same Name,1200');
  assert.equal(result.summary.added, 2);
  assert.equal(result.rows[0].player.external_id, 'external-A');
});
test('ambiguous name-only duplicates are skipped; stable identifiers avoid ambiguity', () => {
  const result = previewImport(snapshot(), 'name,elo\nSame Name,1200\nsame name,1200');
  assert.equal(result.summary.skipped, 1);
});
test('identifier conflicts are reported rather than overwriting another player', () => {
  const state = snapshot([player(1, {
    external_id: 'one'
  }), player(2, {
    external_id: 'two'
  })]);
  const result = previewImport(state, 'external_id,name,email\none,Example,p2@example.test');
  assert.equal(result.summary.invalid, 1);
  assert.equal(result.can_import, false);
});
test('supplied codes are preserved and reserved against automatic allocation', () => {
  let i = 0;
  const draws = [2000, 3000];
  const result = executeCommand(snapshot(), 'player_import', {
    csv: 'name,code\nAutomatic,\nExisting Code,2000'
  }, actor, {
    now,
    draw: () => draws[i++]
  });
  assert.deepEqual(result.state.players.map(p => p.code), ['3000', '2000']);
});
test('optional contact, school and codes are not required for roster intake', () => {
  const result = executeCommand(snapshot(), 'player_add', {
    full_name: 'Walk-in'
  }, actor, options);
  const p = result.data;
  assert.equal(p.seed_rating, 1200);
  assert.equal(p.email, null);
  assert.equal(p.phone, null);
  assert.equal(p.institution_type, null);
  assert.equal(p.checked_in, false);
  assert.match(p.code, /^[1-9]\d{3}$/);
  assert(!('emails' in result));
});
test('imported flags and school fields are normalized', () => {
  const result = previewImport(snapshot(),
    'name,school,present,is_active,email\nExample,ENSIA,yes,1,EXAMPLE@TEST.COM');
  const p = result.rows[0].player;
  assert.equal(p.checked_in, true);
  assert.equal(p.active, true);
  assert.equal(p.institution_type, 'ensia');
  assert.equal(p.email, 'example@test.com');
});
test('default level seeds and Lichess conversion remain available for exports', () => {
  for (const [level, value] of Object.entries(DEFAULT_SETTINGS.level_defaults)) assert.equal(seedRating({
    has_online_rating: false,
    level
  }).seed_rating, value);
  const result = previewImport(snapshot(), 'name,online_rating,platform\nRated,1600,Lichess');
  assert.equal(result.rows[0].player.seed_rating, 1500);
  const state = executeCommand(snapshot(), 'player_import', {
    csv: 'name,online_rating,platform\nRated,1600,Lichess'
  }, actor, options).state;
  assert.equal(state.players[0].seed_source, 'online');
});
test('missing rating defaults to 1200 and unknown columns are reported', () => {
  const result = previewImport(snapshot(), 'name,unused\nExample,abc');
  assert.equal(result.rows[0].player.seed_rating, 1200);
  assert.deepEqual(result.unused_columns, ['unused']);
});
test('capacity is enforced for the whole batch and simultaneous final-slot additions', async () => {
  const state = snapshot();
  state.settings.capacity = 2;
  assert.equal(previewImport(state, 'name\nA\nB\nC').can_import, false);
  const repo = new MemoryRepository(state);
  const results = await Promise.allSettled(Array.from({
    length: 10
  }, (_, i) => mutate(repo, 'player_add', {
    full_name: `P ${i}`
  }, actor, options)));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 2);
  assert.equal(repo.state.players.length, 2);
});
test('1000 secure codes are unique; retries stop after twenty collisions', () => {
  const players = [];
  for (let i = 0; i < 1000; i++) players.push({
    code: uniqueCode(players, () => randomInt(1000, 10000))
  });
  assert.equal(new Set(players.map(p => p.code)).size, 1000);
  let calls = 0;
  assert.throws(() => uniqueCode([{
    code: '1000'
  }], () => {
    calls++;
    return 1000;
  }), /20 attempts/);
  assert.equal(calls, 20);
});
test('regeneration invalidates the old code without queuing a notification', () => {
  const result = executeCommand(snapshot([player(1)]), 'regenerate_code', {
    id: 1
  }, actor, {
    now,
    draw: () => 2000
  });
  assert.equal(result.data.code, '2000');
  assert.equal(result.state.players.some(p => p.code === '1001'), false);
  assert(!('emails' in result));
});
test('public projections omit private contact, external references and codes', () => {
  const state = snapshot([player(1, {
    external_id: 'private-reference'
  }), player(2)]);
  state.rounds = [round(1)];
  state.games = [game(1, 1, 1, 2, 'white')];
  for (const data of [publicData(state, 'players'), publicData(state, 'standings'), publicData(state,
      'games'), playerView(state, 1)])
    for (const field of ['email', 'phone', 'student_id', 'code', 'external_id']) assert(!JSON.stringify(
      data).includes(`"${field}"`));
});
test('public settings contain no registration controls or unannounced counts', () => {
  const state = snapshot();
  state.settings.swiss_rounds_planned = 6;
  state.settings.knockout_size = 8;
  const settings = publicSettings(state);
  assert.equal(settings.swiss_rounds_planned, null);
  assert.equal(settings.knockout_size, null);
  assert(!('registration_open' in settings));
});
test('roster intake cannot be invoked anonymously', () => {
  assert.throws(() => executeCommand(snapshot(), 'player_import', {
    csv: 'name\nA'
  }, null, options), /session/);
});
