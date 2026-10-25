import {
  standings
} from '../tournament/standings.mjs';
import {
  currentRound,
  publicPlayer,
  publicRounds,
  publicSettings
} from '../tournament/model.mjs';
export function roundView(snapshot) {
  const round = currentRound(snapshot);
  if (!round) return null;
  const players = new Map(snapshot.players.map(p => [p.id, publicPlayer(p)]));
  const safeRound = {
    id: round.id,
    number: round.number,
    stage: round.stage,
    status: round.status,
    duration_minutes: round.duration_minutes,
    planned_start: round.planned_start,
    started_at: round.started_at,
    closed_at: round.closed_at,
    warnings: round.warnings,
  };
  return {
    ...safeRound,
    games: snapshot.games.filter(g => g.round_id === round.id && g.kind === 'swiss').map(g => ({
      id: g.id,
      table_number: g.table_number,
      white: players.get(g.white_id),
      black: players.get(g.black_id) ?? null,
      result: g.result,
      is_forfeit: g.is_forfeit
    }))
  };
}
export function playerView(snapshot, id) {
  const player = standings(snapshot).find(p => p.id === id);
  if (!player) return null;
  const round = roundView(snapshot),
    game = round?.games.find(g => g.white.id === id || g.black?.id === id);
  return {
    player,
    round: round ? {
      id: round.id,
      number: round.number,
      status: round.status,
      duration_minutes: round.duration_minutes,
      started_at: round.started_at,
      planned_start: round.planned_start
    } : null,
    match: game ? {
      id: game.id,
      table_number: game.table_number,
      colour: game.black == null ? null : game.white.id === id ? 'white' : 'black',
      opponent: game.black == null ? null : game.white.id === id ? game.black : game.white,
      result: game.result,
      is_forfeit: game.is_forfeit
    } : null
  };
}
export function publicData(snapshot, path) {
  if (path === 'settings/public') return publicSettings(snapshot);
  if (path === 'players') return snapshot.players.filter(p => !p.deleted_at).map(publicPlayer);
  if (path === 'standings') return standings(snapshot);
  if (path === 'rounds/current') return roundView(snapshot);
  if (path === 'games') {
    const rounds = new Map(publicRounds(snapshot).map(r => [r.id, r])),
      players = new Map(snapshot.players.map(p => [p.id, publicPlayer(p)]));
    return snapshot.games.filter(g => rounds.has(g.round_id) && g.kind === 'swiss').map(g => ({
      id: g.id,
      round: rounds.get(g.round_id).number,
      round_status: rounds.get(g.round_id).status,
      table_number: g.table_number,
      white: players.get(g.white_id),
      black: players.get(g.black_id) ?? null,
      result: g.result,
      is_forfeit: g.is_forfeit
    }));
  }
  if (path === 'stats') {
    const round = roundView(snapshot),
      games = round?.games.filter(g => g.black) ?? [];
    return {
      totalPlayers: snapshot.players.filter(p => !p.deleted_at).length,
      totalRounds: publicRounds(snapshot).length,
      totalGames: games.length,
      gamesPlayed: games.filter(g => g.result).length,
      gamesInProgress: games.filter(g => !g.result).length
    };
  }
  return null;
}
