import {
  requireRule,
  settingsOf,
  nextId,
  seedRating,
  uniqueCode,
  tieContext
} from './model.mjs';
import {
  standings
} from './standings.mjs';
import {
  generatePairings,
  assertPairings,
  pairingWarnings,
  assignColours
} from './pairing.mjs';

import {
  appendPlayer,
  previewImport,
  normalizePlayer
} from './player-import.mjs';

export function pairingContext(state) {
  return JSON.stringify([tieContext(state), state.players.filter(p => !p.deleted_at).map(p => [p.id, p.active,
    p.checked_in, p.seed_rating
  ]), settingsOf(state).pairing_weights, settingsOf(state).round1_method]);
}
export function executeCommand(snapshot, action, input, actor, {
  now = new Date().toISOString(),
  draw
} = {}) {
  const state = structuredClone(snapshot),
    settings = settingsOf(state);
  state.settings = settings;
  const admin = actor?.role === 'admin' || actor?.role === 'arbiter';
  requireRule(admin, 'Admin session required.', 401);
  if (actor?.role === 'arbiter') requireRule(action === 'result',
    'Only the main admin can perform this action.', 403);
  const roundById = id => {
    const round = state.rounds.find(r => r.id === id);
    requireRule(round, 'Round not found.', 404);
    return round;
  };
  const playerById = id => {
    const p = state.players.find(p => p.id === id && !p.deleted_at);
    requireRule(p, 'Player not found.', 404);
    return p;
  };
  const invalidateDrafts = () => {
    for (const round of state.rounds)
      if (round.status === 'draft') round.invalidated = true;
  };
  let data;
  if (action === 'player_add') {
    data = appendPlayer(state, input, now, draw);
    invalidateDrafts();
  } else if (action === 'player_import') {
    const preview = previewImport(state, input.csv);
    requireRule(preview.can_import, preview.error || preview.rows.filter(row => row.status === 'error').map(
      row => `Row ${row.row}: ${row.reason}`).join(' '), 400, 'INVALID_IMPORT');
    const additions = preview.rows.filter(row => row.status === 'add');
    const reserved = additions.map(row => row.player.code).filter(Boolean);
    for (const row of additions) appendPlayer(state, row.player, now, draw, reserved, true);
    if (additions.length) invalidateDrafts();
    data = preview.summary;
  } else if (action === 'player_edit' || action === 'player_delete' || action === 'regenerate_code') {
    const p = playerById(input.id);
    if (action === 'player_delete') {
      requireRule(!state.games.some(g => g.white_id === p.id || g.black_id === p.id),
        'This player has games. Withdraw them instead.', 409);
      p.deleted_at = now;
      p.active = false;
      p.checked_in = false;
    } else if (action === 'regenerate_code') {
      p.code = uniqueCode(state.players, draw);
    } else {
      const patch = input.patch;
      const locked = settings.ratings_locked || state.rounds.some(r => r.stage === 'swiss' && r.number ===
        1 && r.status !== 'draft');
      const seedFields = ['seed_rating', 'has_online_rating', 'online_rating', 'rating_platform',
        'rating_time_control', 'level'
      ];
      requireRule(!locked || !seedFields.some(key => key in patch && patch[key] !== p[key]),
        'Seed ratings are locked after Round 1 publication.', 409);
      const merged = {
        ...p,
        ...patch
      };
      const normalized = normalizePlayer(merged, settings);
      merged.full_name = normalized.full_name;
      merged.email = normalized.email;
      merged.phone = normalized.phone;
      merged.external_id = normalized.external_id;
      if (merged.external_id) requireRule(!state.players.some(other => other.id !== p.id && other
        .external_id === merged.external_id), 'External reference already belongs to a player.', 409);
      if (merged.email) requireRule(!state.players.some(other => other.id !== p.id && other.email === merged
        .email), 'Email already belongs to a player.', 409);
      if (seedFields.some(key => key in patch)) {
        merged.seed_rating = 'seed_rating' in patch ? patch.seed_rating : seedRating(merged, settings)
          .seed_rating;
        requireRule(Number.isInteger(merged.seed_rating) && merged.seed_rating >= 0 && merged.seed_rating <=
          3500, 'Invalid seed rating.');
        merged.seed_source = 'admin';
      }
      if (p.active && merged.active === false) {
        for (const game of state.games) {
          const round = roundById(game.round_id);
          if (round.status === 'running' && !game.result && [game.white_id, game.black_id].includes(p.id)) {
            game.result = game.white_id === p.id ? 'black' : 'white';
            game.is_forfeit = true;
            game.finished_at = now;
            game.entered_by = actor.email;
          }
        }
      }
      Object.assign(p, merged);
    }
    p.updated_at = now;
    invalidateDrafts();
    data = p;
  } else if (action === 'generate') {
    requireRule(['check_in', 'swiss'].includes(settings.tournament_state),
      'Open check-in before generating Round 1.', 409);
    const previous = [...state.rounds].sort((a, b) => b.number - a.number)[0];
    requireRule(!previous || previous.status === 'closed',
      'Close the previous round before generating another.', 409);
    const pairing = generatePairings(standings(state), {
      ...settings,
      round_number: (previous?.number ?? 0) + 1
    });
    const round = {
      id: nextId(state.rounds),
      number: (previous?.number ?? 0) + 1,
      stage: 'swiss',
      status: 'draft',
      duration_minutes: settings.round_minutes,
      planned_start: null,
      started_at: null,
      closed_at: null,
      warnings: pairing.warnings,
      context: pairingContext(state),
      invalidated: false
    };
    state.rounds.push(round);
    let id = nextId(state.games);
    state.games.push(...pairing.games.map(game => ({
      ...game,
      id: id++,
      round_id: round.id,
      finished_at: game.result ? now : null,
      entered_by: actor.email,
      updated_at: now
    })));
    data = {
      round,
      fallback: pairing.fallback,
      recovery: pairing.recovery
    };
  } else if (['swap', 'publish', 'start', 'close', 'round_delete'].includes(action)) {
    const round = roundById(input.id),
      games = state.games.filter(g => g.round_id === round.id && g.kind === 'swiss');
    if (action === 'round_delete') {
      requireRule(round.number === Math.max(...state.rounds.map(r => r.number)),
        'Only the most recent round can be removed.', 409);
      state.games = state.games.filter(g => g.round_id !== round.id);
      state.rounds = state.rounds.filter(r => r.id !== round.id);
    } else if (action === 'swap') {
      requireRule(round.status === 'draft' && !round.invalidated, 'Regenerate the draft before editing.',
        409);
      requireRule(input.player_a !== input.player_b, 'Choose two different players.');
      const pool = standings(state).filter(p => p.active && p.checked_in),
        byId = new Map(pool.map(p => [p.id, p]));
      requireRule(byId.has(input.player_a) && byId.has(input.player_b), 'Choose eligible players.');
      for (const game of games) {
        for (const key of ['white_id', 'black_id'])
          if (game[key] === input.player_a) game[key] = input.player_b;
          else if (game[key] === input.player_b) game[key] = input.player_a;
        if (game.black_id) {
          const colours = assignColours(byId.get(game.white_id), byId.get(game.black_id), round.number === 1 ?
            game.table_number : null);
          game.white_id = colours.white.id;
          game.black_id = colours.black.id;
        }
      }
      assertPairings(games, pool);
      round.warnings = pairingWarnings(games, pool);
    } else if (action === 'publish') {
      requireRule(round.status === 'draft' && !round.invalidated && round.context === pairingContext(state),
        'Draft is stale. Delete it and generate again.', 409);
      assertPairings(games, standings(state).filter(p => p.active && p.checked_in));
      round.status = 'published';
      round.planned_start = input.planned_start ?? null;
      settings.tournament_state = 'swiss';
      if (round.number === 1) settings.ratings_locked = true;
    } else if (action === 'start') {
      requireRule(round.status === 'published', 'Only published rounds can start.', 409);
      round.status = 'running';
      round.started_at = now;
    } else {
      requireRule(round.status === 'running', 'Only running rounds can close.', 409);
      requireRule(games.every(g => g.result), 'Enter a result for every table before closing.', 409);
      round.status = 'closed';
      round.closed_at = now;
    }
    data = round;
  } else if (action === 'result') {
    const game = state.games.find(g => g.id === input.id);
    requireRule(game, 'Game not found.', 404);
    const round = roundById(game.round_id);
    input = {
      ...input,
      result: 'result' in input ? input.result : game.result,
      is_forfeit: input.is_forfeit ?? game.is_forfeit
    };
    requireRule(round.status === 'running' || round.status === 'closed' && actor.role === 'admin',
      'Results require a running round; only the main admin can correct closed rounds.', 403);
    const later = state.rounds.some(r => r.number > round.number && r.status !== 'draft');
    requireRule(!later || input.acknowledge_later_rounds === true,
      'Later pairings are published. Main admin must acknowledge their reconciliation.', 409);
    requireRule([null, 'white', 'black', 'draw', 'bye', 'double_forfeit'].includes(input.result),
      'Invalid game result.');
    requireRule(round.status !== 'closed' || input.result != null,
      'A closed round cannot contain unfinished games.', 409);
    requireRule(game.kind !== 'armageddon' || ['white', 'black', 'draw'].includes(input.result),
      'Armageddon requires a win or draw.');
    if (input.result === 'double_forfeit') input = {
      ...input,
      is_forfeit: true
    };
    requireRule(input.result !== 'bye' || game.black_id == null, 'A bye cannot have an opponent.');
    requireRule(game.black_id != null || input.result === 'bye', 'Solo byes always award one point.');
    requireRule(!input.is_forfeit || input.result === 'white' || input.result === 'black' || input.result ===
      'double_forfeit', 'A forfeit must have a winner or be a double forfeit.');
    if (input.is_forfeit && (!game.is_forfeit || game.result !== input.result) && round.status === 'running')
      requireRule(Date.parse(now) - Date.parse(round
          .started_at) >= settings.late_forfeit_minutes * 60000, 'The late-forfeit period has not elapsed.',
        409);
    Object.assign(game, {
      result: input.result,
      is_forfeit: input.is_forfeit ?? false,
      notes: 'notes' in input ? input.notes : game.notes ?? null,
      pgn: 'pgn' in input ? input.pgn : game.pgn ?? null,
      moves_count: 'moves_count' in input ? input.moves_count : game.moves_count ?? null,
      finished_at: input.result ? game.finished_at || now : null,
      entered_by: actor.email,
      updated_at: now
    });
    invalidateDrafts();
    data = game;
  } else if (action === 'armageddon') {
    const ranked = standings(state),
      a = ranked.find(p => p.id === input.white_id),
      b = ranked.find(p => p.id === input.black_id);
    requireRule(a && b && a.id !== b.id && a.tie && a.rank === b.rank,
      'Choose two players still tied in standings.');
    requireRule(['white', 'black', 'draw'].includes(input.result), 'Record the Armageddon outcome.');
    const round = [...state.rounds].filter(r => r.stage === 'swiss' && r.status !== 'draft').sort((a, b) => b
      .number - a.number)[0];
    requireRule(round, 'A published Swiss round is required.');
    const game = {
      id: nextId(state.games),
      round_id: round.id,
      white_id: a.id,
      black_id: b.id,
      table_number: null,
      kind: 'armageddon',
      result: input.result,
      is_forfeit: false,
      tie_context: tieContext(state),
      finished_at: now,
      entered_by: actor.email,
      updated_at: now
    };
    state.games.push(game);
    const resolved = standings(state),
      winner = input.result === 'white' ? a.id : b.id,
      loser = winner === a.id ? b.id : a.id;
    requireRule(resolved.find(p => p.id === winner).rank < resolved.find(p => p.id === loser).rank,
      'This resolution contradicts another recorded tie-break.');
    data = game;
  } else if (action === 'settings') {
    Object.assign(settings, input);
    invalidateDrafts();
    data = settings;
  } else requireRule(false, 'Unknown operation.', 404);
  state.revision = snapshot.revision + 1;
  return {
    state,
    data
  };
}
