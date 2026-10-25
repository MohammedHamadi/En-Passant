import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {
  Pool
} from 'pg';
import {
  randomInt
} from 'node:crypto';
import {
  mutate
} from '../src/lib/server/repository.mjs';
import {
  standings
} from '../src/lib/tournament/standings.mjs';
import {
  playerInput,
  actor,
  now
} from '../tests/fixtures.mjs';

const url = process.env.TEST_DATABASE_URL;
if (!url || new URL(url).pathname !== '/enpassant_test') throw new Error(
  'TEST_DATABASE_URL must point to a disposable database named enpassant_test. Production databases are refused.'
);
const pool = new Pool({
  connectionString: url,
  max: 8
});
try {
  const exists = await pool.query("select to_regclass('public.players') as existing");
  if (exists.rows[0].existing) throw new Error(
    'Use a fresh, empty enpassant_test database. Existing player tables are never overwritten.');
  await pool.query(
    "do $$ begin if not exists(select from pg_roles where rolname='anon') then create role anon;end if;if not exists(select from pg_roles where rolname='authenticated') then create role authenticated;end if;if not exists(select from pg_roles where rolname='service_role') then create role service_role;end if;end $$;"
  );
  await pool.query(await fs.readFile(new URL('../database/schema.sql', import.meta.url), 'utf8'));
  await pool.query(
    "insert into public.players(id,full_name,elo) values(1,'Legacy One',1500),(2,'Legacy Two',1400),(3,'Legacy Bye',1200);insert into public.matches(round_number,white_player_id,black_player_id,white_score,black_score,is_bye,white_bye) values(1,1,2,1,0,false,false),(1,3,null,1,null,true,true);"
  );
  for (const name of (await fs.readdir(new URL('../database/migrations/', import.meta.url))).filter(n => n
      .endsWith('.sql')).sort()) await pool.query(await fs.readFile(new URL(`../database/migrations/${name}`,
    import.meta.url), 'utf8'));
  const call = async (name, args = []) => (await pool.query(
    `select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as result`, args)).rows[0].result;
  const repo = {
    read: () => call('ep_snapshot'),
    commit: (expected, state, who, action) => call('ep_commit', [expected, JSON.stringify(state),
      who, action
    ]).catch(error => {
      if (error.code === '40001') error.code = 'STALE_REVISION';
      throw error;
    })
  };
  let state = await repo.read();
  assert.equal(state.players.length, 3);
  assert.equal(state.games.length, 2);
  assert.equal(standings(state).find(p => p.id === 3).score, 1);
  assert(state.players.every(p => /^[1-9]\d{3}$/.test(p.code)));
  const client = await pool.connect();
  try {
    await client.query('set role anon');
    await assert.rejects(client.query('select * from public.players'), /permission denied/);
    await assert.rejects(client.query('select public.ep_snapshot()'), /permission denied/);
    await client.query('reset role');
    await client.query('set role authenticated');
    await assert.rejects(client.query('update public.players set active=false'), /permission denied/);
  } finally {
    await client.query('reset role');
    client.release();
  }
  await mutate(repo, 'settings', {
    capacity: 5
  }, actor, {
    now
  });
  const additions = await Promise.allSettled(Array.from({
    length: 8
  }, (_, i) => mutate(repo, 'player_add', playerInput({
    email: `new${i}@example.test`
  }), actor, {
    now,
    draw: () => randomInt(1000, 10000)
  })));
  assert.equal(additions.filter(r => r.status === 'fulfilled').length, 2);
  state = await repo.read();
  assert.equal(state.players.length, 5);
  assert.equal(state.players.filter(p => !p.checked_in).length, 2);
  const result = await pool.query('select count(*)::int as total from public.audit_log');
  assert(result.rows[0].total >= 3);
  for (let i = 1; i <= 10; i++) {
    const rate = await call('ep_rate', ['lookup-test', 10, 60, true, false]);
    assert.equal(rate.blocked, i === 10);
  }
  assert.equal((await call('ep_rate', ['lookup-test', 10, 60, false, false])).blocked, true);
  await pool.query(
    "update public.request_limits set blocked_until=now()-interval '1 second',window_start=now()-interval '2 minutes' where key='lookup-test'"
  );
  assert.equal((await call('ep_rate', ['lookup-test', 10, 60, false, false])).blocked, false);
  const revision = state.revision;
  await call('ep_commit', [revision, JSON.stringify(state), 'test', 'revision']);
  await assert.rejects(call('ep_commit', [revision, JSON.stringify(state), 'test', 'revision']),
    /STALE_REVISION/);
  state = await repo.read();
  const bad = structuredClone(state);
  bad.games.push({
    ...bad.games[0],
    id: 999,
    table_number: 99
  });
  await assert.rejects(call('ep_commit', [state.revision, JSON.stringify(bad), 'test', 'invalid']),
    /duplicate key/);
  assert.equal((await repo.read()).revision, state.revision);
  await mutate(repo, 'settings', {
    capacity: 6
  }, actor, {
    now
  });
  const uploaded = await mutate(repo, 'player_import', {
    csv: 'external_id,name,elo\nsource-1,Imported Player,1600'
  }, actor, {
    now,
    draw: () => randomInt(1000, 10000)
  });
  assert.equal(uploaded.added, 1);
  assert.equal((await repo.read()).players.find(p => p.external_id === 'source-1').seed_rating, 1600);
  assert.equal((await mutate(repo, 'player_import', {
    csv: 'external_id,name,elo\nsource-1,Imported Player,1600'
  }, actor, {
    now,
    draw: () => randomInt(1000, 10000)
  })).skipped, 1);
  console.log(
    'Database integration passed: legacy migration, permissions, concurrent capacity, audit, rate limits, revision rollback, participation uniqueness, and roster import/deduplication.'
  );
} finally {
  await pool.end();
}
