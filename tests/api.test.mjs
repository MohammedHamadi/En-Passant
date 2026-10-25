import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  registerHooks
} from 'node:module';
import {
  pathToFileURL
} from 'node:url';
import {
  MemoryRepository
} from '../src/lib/server/repository.mjs';
import {
  snapshot,
  player,
  playerInput,
  actor,
  round,
  game
} from './fixtures.mjs';
import {
  createAdminSessionToken
} from '../src/lib/auth/session.mjs';
import {
  NextRequest
} from './adapters/framework.mjs';

// Exercise the production handler. Only framework caching/response and database IO are adapted.
// Optional paths let a restricted runner use the same upstream libraries without npm access.
const hooks = registerHooks({
  resolve(specifier, context, next) {
    const adapters = {
      'next/server': 'framework.mjs',
      'next/cache': 'cache.mjs'
    };
    if (specifier === 'server-only') return {
      url: 'data:text/javascript,export default undefined;',
      shortCircuit: true
    };
    if (adapters[specifier]) return {
      url: new URL('./adapters/' + adapters[specifier], import.meta.url).href,
      shortCircuit: true
    };
    if (specifier === 'zod' && process.env.ZOD_TEST_MODULE_PATH) return {
      url: pathToFileURL(process.env.ZOD_TEST_MODULE_PATH).href,
      shortCircuit: true
    };
    if (specifier === 'bcryptjs' && process.env.BCRYPT_TEST_MODULE_PATH) return {
      url: pathToFileURL(process.env.BCRYPT_TEST_MODULE_PATH).href,
      shortCircuit: true
    };
    if (context.parentURL?.endsWith('/server/api.ts') && ['./database'].includes(specifier))
      return {
        url: new URL('./adapters/' + specifier.slice(2) + '.mjs', import.meta.url).href,
        shortCircuit: true
      };
    if (specifier.startsWith('.') && context.parentURL) {
      const url = new URL(specifier + '.ts', context.parentURL);
      if (fs.existsSync(url)) return {
        url: url.href,
        shortCircuit: true
      };
    }
    return next(specifier, context);
  }
});
const {
  handleApi
} = await import('../src/lib/server/api.ts');
const {
  playerSchema,
  playerPatchSchema,
  resultSchema
} = await import('../src/lib/server/schemas.ts');
const bcrypt = (await import('bcryptjs')).default;
hooks.deregister();
process.env.ADMIN_SESSION_SECRET = 'test-only-secret-0000000000000000000000000000';
process.env.ADMIN_EMAILS = actor.email;
process.env.SITE_URL = 'https://event.example.test';
process.env.ADMIN_PASSWORD_HASH = await bcrypt.hash('test-only-password', 4);

function reset(state = snapshot([player(1)])) {
  const repo = new MemoryRepository(state),
    rates = new Map();
  const context = {
    repo,
    rates,
    lookups: 0,
    invalidations: 0,
    after: [],
    rpc: async (name, args = {}) => {
      if (name === 'ep_snapshot') return repo.read();
      if (name === 'ep_commit') return repo.commit(args.p_expected, args.p_state, args.p_actor, args
        .p_action);
      if (name === 'ep_lookup_code') {
        context.lookups++;
        return {
          player_id: repo.state.players.find(p => p.code === args.p_code && !p.deleted_at)?.id ?? null
        };
      }
      if (name === 'ep_rate') {
        const count = (rates.get(args.p_key) || 0) + (args.p_fail ? 1 : 0);
        rates.set(args.p_key, count);
        return {
          blocked: count >= args.p_limit,
          retry_after: 60
        };
      }
      if (name === 'ep_alert') return;
      throw new Error('Unexpected RPC ' + name);
    }
  };
  globalThis.__epRouteTest = context;
  return context;
}
async function request(path, method = 'GET', value, token, origin = 'https://event.example.test') {
  const headers = {
    origin
  };
  if (value !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.cookie = `admin_session=${token}`;
  const response = await handleApi(new NextRequest(`https://event.example.test/api/${path}`, {
    method,
    headers,
    body: value === undefined ? undefined : JSON.stringify(value)
  }));
  return {
    response,
    body: await response.json()
  };
}
test('API rejects unauthenticated writes and cross-origin admin requests', async () => {
  const context = reset();
  assert.equal((await request('admin/players/1', 'PATCH', {
    checked_in: false
  })).response.status, 401);
  const token = await createAdminSessionToken(actor.email);
  assert.equal((await request('admin/players/1', 'PATCH', {
    checked_in: false
  }, token, 'https://other.example.test')).response.status, 403);
  assert.equal(context.repo.audit.length, 0);
});
test('player intake accepts minimal data and rejects invalid/injected fields', () => {
  assert.equal(playerSchema.safeParse({
    full_name: 'Imported Player'
  }).success, true);
  assert.equal(playerSchema.safeParse({
    full_name: ''
  }).success, false);
  assert.equal(playerSchema.safeParse(playerInput({
    email: 'invalid'
  })).success, false);
  assert.equal(playerSchema.safeParse(playerInput({
    role: 'admin'
  })).success, false);
  assert.equal(playerPatchSchema.safeParse({
    code: '1234'
  }).success, false);
  assert.equal(resultSchema.safeParse({
    result: 'white',
    white_id: 2
  }).success, false);
});
test('public registration and email delivery endpoints are absent', async () => {
  reset();
  assert.equal((await request('register', 'POST', playerInput())).response.status, 404);
  assert.equal((await request('internal/email', 'POST', {})).response.status, 404);
  assert.equal((await request('admin/players', 'POST', playerInput())).response.status, 401);
});
test('admin adds a player without requiring contact data', async () => {
  const context = reset(),
    token = await createAdminSessionToken(actor.email);
  const result = await request('admin/players', 'POST', playerInput(), token);
  assert.equal(result.response.status, 201);
  assert.match(result.body.code, /^[1-9]\d{3}$/);
  assert.equal(result.body.checked_in, false);
  assert.equal(result.body.email, null);
  assert.equal(context.after.length, 0);
});
test('CSV preview and import require an admin and preserve existing players', async () => {
  const context = reset(),
    token = await createAdminSessionToken(actor.email),
    csv = 'name,elo\nUploaded Player,1600\n';
  assert.equal((await request('admin/players/import', 'POST', {
    csv
  })).response.status, 401);
  const before = await request('admin/players/import/preview', 'POST', {
    csv
  }, token);
  assert.equal(before.body.summary.added, 1);
  assert.equal(context.repo.state.players.length, 1);
  const uploaded = await request('admin/players/import', 'POST', {
    csv
  }, token);
  assert.equal(uploaded.body.added, 1);
  assert.equal(context.repo.state.players[1].seed_rating, 1600);
  assert.equal((await request('admin/players/import', 'POST', {
    csv
  }, token)).body.skipped, 1);
  assert.equal(context.repo.state.players.length, 2);
});
test('invalid CSV produces a JSON error and commits no partial rows', async () => {
  const context = reset(),
    token = await createAdminSessionToken(actor.email),
    csv = 'name,elo\nValid Name,1000\nBad Rating,nope\n';
  assert.equal((await request('admin/players/import', 'POST', {
    csv
  }, token)).response.status, 400);
  assert.equal(context.repo.state.players.length, 1);
  assert.equal(context.repo.audit.length, 0);
});
test('code lookup blocks after ten incorrect attempts and sends Retry-After', async () => {
  const context = reset();
  for (let i = 0; i < 9; i++) assert.equal((await request('me', 'POST', {
    code: '9999'
  })).response.status, 401);
  const tenth = await request('me', 'POST', {
    code: '9999'
  });
  assert.equal(tenth.response.status, 429);
  assert.equal(tenth.response.headers.get('retry-after'), '60');
  assert.equal((await request('me', 'POST', {
    code: '1001'
  })).response.status, 429);
  assert.equal(context.lookups, 10);
});
test('successful lookup does not clear previous wrong attempts; drafts remain private', async () => {
  const s = snapshot([player(1), player(2)]);
  s.rounds = [round(1, {
    status: 'draft'
  })];
  s.games = [game(1, 1, 1, 2, null)];
  const context = reset(s);
  await request('me', 'POST', {
    code: '9999'
  });
  const view = await request('me', 'POST', {
    code: '1001'
  });
  assert.equal(view.response.status, 200);
  assert.equal(view.body.match, null);
  assert(!JSON.stringify(view.body).includes('email"'));
  assert.equal([...context.rates.values()][0], 1);
  assert.deepEqual((await request('games')).body.data, []);
});
test('public API excludes contacts and retains withdrawn players', async () => {
  reset(snapshot([player(1, {
    active: false
  })]));
  for (const path of ['players', 'standings']) {
    const result = await request(path);
    assert.equal(result.body.data.length, 1);
    for (const field of ['email', 'phone', 'student_id', 'code']) assert(!JSON.stringify(result.body)
      .includes(`"${field}"`));
  }
});
test('login verifies bcrypt and issues an eight-hour httpOnly strict cookie', async () => {
  reset();
  let result = await request('admin/login', 'POST', {
    email: actor.email,
    password: 'wrong'
  });
  assert.equal(result.response.status, 401);
  result = await request('admin/login', 'POST', {
    email: actor.email,
    password: 'test-only-password'
  });
  assert.equal(result.response.status, 200);
  assert.match(result.response.headers.get('set-cookie'), /HttpOnly; SameSite=strict; Max-Age=28800/);
});
test('missing password hash never falls back to a shared plaintext default', async () => {
  reset();
  const hash = process.env.ADMIN_PASSWORD_HASH;
  delete process.env.ADMIN_PASSWORD_HASH;
  const result = await request('admin/login', 'POST', {
    email: actor.email,
    password: 'we-love-chess-for-real'
  });
  assert.equal(result.response.status, 503);
  process.env.ADMIN_PASSWORD_HASH = hash;
});
