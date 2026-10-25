import 'server-only';
import {
  randomInt,
  createHmac
} from 'node:crypto';
import bcrypt from 'bcryptjs';
import {
  NextRequest,
  NextResponse
} from 'next/server';
import {
  unstable_cache,
  revalidateTag
} from 'next/cache';
import {
  z
} from 'zod';
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  createAdminSessionToken,
  verifyAdminSessionToken,
  roleForEmail,
  sessionSecret
} from '../auth/session.mjs';
import {
  TournamentError,
  requireRule,
  settingsOf
} from '../tournament/model.mjs';
import {
  standings
} from '../tournament/standings.mjs';
import {
  previewImport
} from '../tournament/player-import.mjs';
import {
  mutate
} from './repository.mjs';
import {
  publicData,
  playerView
} from './public.mjs';
import {
  repository,
  rpc
} from './database';
import {
  playerSchema,
  importSchema,
  playerPatchSchema,
  resultSchema,
  loginSchema,
  codeSchema,
  settingsSchema,
  swapSchema,
  publishSchema,
  armageddonSchema
} from './schemas';

const cachedSnapshot = unstable_cache(() => repository.read(), ['en-passant-public'], {
  revalidate: 3,
  tags: ['en-passant']
});
const cookieOptions: {
  httpOnly: boolean;secure: boolean;sameSite: 'strict';path: string;maxAge: number
} = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/',
  maxAge: ADMIN_SESSION_MAX_AGE_SECONDS
};
const reply = (data: unknown, status = 200) => NextResponse.json(data, {
  status,
  headers: {
    'Cache-Control': 'no-store'
  }
});
async function body(request: NextRequest, schema: z.ZodTypeAny) {
  requireRule(Number(request.headers.get('content-length') || 0) <= 1000000, 'Request body too large.',
  413);
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  if (reader) {
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        total += chunk.value.byteLength;
        if (total > 1000000) {
          await reader.cancel();
          throw new TournamentError('Request body too large.', 413);
        }
        chunks.push(chunk.value);
      }
    } finally {
      reader.releaseLock();
    }
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  let value;
  try {
    value = raw ? JSON.parse(raw) : {};
  } catch {
    throw new TournamentError('Invalid JSON.');
  }
  return schema.parse(value);
}

function csrf(request: NextRequest) {
  const expected = process.env.SITE_URL ? new URL(process.env.SITE_URL).origin : request.nextUrl.origin;
  requireRule(request.headers.get('origin') === expected, 'Request origin is not allowed.', 403);
}
async function session(request: NextRequest) {
  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  return token ? verifyAdminSessionToken(token) : null;
}
async function rate(request: NextRequest, bucket: string, fail = false) {
  // Forwarded headers are trusted only behind an explicitly configured trusted proxy.
  const ip = process.env.TRUST_PROXY === 'true' ? (request.headers.get('x-forwarded-for')?.split(',')[0]
    .trim() || 'unknown') : 'untrusted-network';
  const key = createHmac('sha256', sessionSecret()).update(`${bucket}:${ip}`).digest('hex');
  const result = await rpc('ep_rate', {
    p_key: key,
    p_limit: bucket === 'me' ? 10 : 5,
    p_seconds: 60,
    p_fail: fail
  });
  if (result.blocked) throw Object.assign(new TournamentError(
    'Too many incorrect attempts. Try again in 60 seconds.', 429), {
    retryAfter: result.retry_after
  });
}
async function write(action: string, input: unknown, actor: unknown) {
  const result = await mutate(repository, action, input, actor, {
    draw: () => randomInt(1000, 10000)
  });
  revalidateTag('en-passant', {
    expire: 0
  });
  return reply(result, action === 'player_add' || action === 'generate' ? 201 :
    200);
}
export async function handleApi(request: NextRequest) {
  try {
    const path = request.nextUrl.pathname.replace(/^\/api\//, ''),
      method = request.method;
    if (['auth/session', 'admin/session'].includes(path) && method === 'GET') {
      const actor = await session(request);
      return reply({
        authenticated: Boolean(actor),
        email: actor?.email ?? null,
        role: actor?.role ?? null
      });
    }
    if (['admin/login', 'auth/login'].includes(path) && method === 'POST') {
      csrf(request);
      await rate(request, 'login');
      const input = await body(request, loginSchema),
        hash = process.env.ADMIN_PASSWORD_HASH;
      requireRule(hash && /^\$2[aby]\$/.test(hash), 'Admin password hash is not configured.', 503);
      if (!roleForEmail(input.email) || Buffer.byteLength(input.password) > 72 || !await bcrypt.compare(
          input.password, hash)) {
        await rate(request, 'login', true);
        throw new TournamentError('Invalid credentials.', 401);
      }
      const response = reply({
        ok: true
      });
      response.cookies.set(ADMIN_SESSION_COOKIE, await createAdminSessionToken(input.email), cookieOptions);
      return response;
    }
    if (['admin/logout', 'auth/logout'].includes(path) && method === 'POST') {
      csrf(request);
      const response = reply({
        ok: true
      });
      response.cookies.set(ADMIN_SESSION_COOKIE, '', {
        ...cookieOptions,
        maxAge: 0
      });
      return response;
    }
    if (path === 'me' && method === 'POST') {
      await rate(request, 'me');
      let input;
      try {
        input = await body(request, codeSchema);
      } catch {
        await rate(request, 'me', true);
        throw new TournamentError('Enter a valid four-digit code.', 401);
      }
      const lookup = await rpc('ep_lookup_code', {
        p_code: input.code
      });
      if (!lookup?.player_id) {
        await rate(request, 'me', true);
        throw new TournamentError('Code not found. Check your code or ask the check-in desk.', 401);
      }
      let snapshot = await cachedSnapshot();
      if (!snapshot.players.some(p => p.id === lookup.player_id)) snapshot = await repository.read();
      return reply({
        ...playerView(snapshot, lookup.player_id),
        server_time: new Date().toISOString()
      });
    }
    if (method === 'GET' && ['settings/public', 'players', 'standings', 'rounds/current', 'games', 'stats']
      .includes(path)) {
      return reply({
        data: publicData(await cachedSnapshot(), path),
        server_time: new Date().toISOString()
      });
    }
    if (path.startsWith('admin/')) {
      const actor = await session(request);
      requireRule(actor, 'Admin session required.', 401);
      if (method !== 'GET') csrf(request);
      if (method === 'GET' && path === 'admin/state') {
        const snapshot = await repository.read();
        return reply({
          ...snapshot,
          settings: settingsOf(snapshot),
          players: actor.role === 'admin' ? snapshot.players : standings(snapshot),
          standings: standings(snapshot),
          role: actor.role,
          server_time: new Date().toISOString()
        });
      }
      if (method === 'GET' && path === 'admin/players') {
        requireRule(actor.role === 'admin', 'Main admin required.', 403);
        return reply((await repository.read()).players.filter(p => !p.deleted_at));
      }
      if (method === 'GET' && path === 'admin/audit') {
        requireRule(actor.role === 'admin', 'Main admin required.', 403);
        return reply(await rpc('ep_audit'));
      }
      if (method === 'POST' && path === 'admin/players') return await write('player_add', await body(
        request,
        playerSchema), actor);
      if (method === 'POST' && ['admin/players/import/preview', 'admin/players/import'].includes(path)) {
        requireRule(actor.role === 'admin', 'Main admin required.', 403);
        const input = await body(request, importSchema);
        if (path.endsWith('/preview')) return reply(previewImport(await repository.read(), input.csv));
        return await write('player_import', input, actor);
      }
      if (method === 'POST' && path === 'admin/rounds/generate') return await write('generate', {}, actor);
      if (method === 'PATCH' && path === 'admin/settings') return await write('settings', await body(
        request,
        settingsSchema), actor);
      if (method === 'POST' && path === 'admin/armageddon') return await write('armageddon', await body(
        request,
        armageddonSchema), actor);
      let match = path.match(/^admin\/players\/(\d+)(?:\/(regenerate-code))?$/);
      if (match) {
        const id = Number(match[1]);
        if (method === 'PATCH' && !match[2]) return await write('player_edit', {
          id,
          patch: await body(request, playerPatchSchema)
        }, actor);
        if (method === 'DELETE' && !match[2]) return await write('player_delete', {
          id
        }, actor);
        if (method === 'POST' && match[2]) return await write('regenerate_code', {
          id
        }, actor);
      }
      match = path.match(/^admin\/rounds\/(\d+)(?:\/(swap|publish|start|close))?$/);
      if (match) {
        const id = Number(match[1]),
          action = match[2];
        if (method === 'DELETE' && !action) return await write('round_delete', {
          id
        }, actor);
        if (method === 'POST' && action) return await write(action, {
          id,
          ...(action === 'swap' ? await body(request, swapSchema) : action === 'publish' ? await body(
            request, publishSchema) : {})
        }, actor);
      }
      match = path.match(/^admin\/games\/(\d+)$/);
      if (match && method === 'PATCH') return await write('result', {
        id: Number(match[1]),
        ...await body(request, resultSchema)
      }, actor);
    }
    throw new TournamentError('Endpoint not found.', 404);
  } catch (error) {
    if (error?.code === 'CODE_EXHAUSTED') {
      console.error('Admin alert: player-code allocation exhausted after 20 attempts.');
      await rpc('ep_alert', {
        p_action: 'CODE_EXHAUSTED: code allocation failed after 20 attempts'
      }).catch(() => {});
    }
    if (error instanceof z.ZodError) return reply({
      error: error.issues.map(issue => issue.message).join(' ')
    }, 400);
    const known = error instanceof TournamentError;
    if (!known) console.error('Tournament request failed', {
      name: error?.name
    });
    const response = reply({
      error: known ? error.message : 'Server configuration or request failed. Contact the organisers.',
      code: known ? error.code : 'SERVER_ERROR'
    }, known ? error.status : 503);
    if (error?.retryAfter) response.headers.set('Retry-After', String(error.retryAfter));
    return response;
  }
}
