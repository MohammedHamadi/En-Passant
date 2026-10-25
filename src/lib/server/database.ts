import 'server-only';
import {
  TournamentError
} from '../tournament/model.mjs';
export async function rpc(name: string, body: Record < string, unknown > = {}) {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new TournamentError(
    'Database is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.', 503);
  const response = await fetch(`${url.replace(/\/$/,'')}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${key}`
    },
    body: JSON.stringify(body),
    cache: 'no-store',
    signal: AbortSignal.timeout(15000)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (data?.code === '40001') throw new TournamentError('State changed. Please retry.', 409,
      'STALE_REVISION');
    if (data?.code === '23505') throw new TournamentError(
      'A code, email, or round participant already exists. Retry the operation.', 409, 'UNIQUE_CONFLICT'
    );
    console.error('Tournament RPC failed', {
      operation: name,
      code: data?.code,
      status: response.status
    });
    throw new TournamentError('Database operation failed. Check migrations and server configuration.', 503);
  }
  return data;
}
export const repository = {
  read: () => rpc('ep_snapshot'),
  commit: (expected: number, state: unknown, actor: string, action: string) => rpc(
    'ep_commit', {
      p_expected: expected,
      p_state: state,
      p_actor: actor,
      p_action: action,
    })
};
