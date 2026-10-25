export const DEFAULT_SETTINGS = Object.freeze({
  tournament_state: 'check_in',
  capacity: 64,
  swiss_rounds_planned: null,
  show_rounds_publicly: false,
  knockout_size: null,
  show_knockout_size_publicly: false,
  ratings_locked: false,
  round_minutes: 30,
  late_forfeit_minutes: 10,
  round1_method: 'closest',
  lichess_offset: 100,
  level_defaults: {
    beginner: 400,
    casual: 800,
    intermediate: 1200,
    advanced: 1600,
    experienced: 1900
  },
  pairing_weights: {
    rating: 1,
    score_gap: 30,
    both_must: 500,
    must_prefer: 60,
    both_prefer: 20,
    rematch: 10000
  },
  schedule: [],
});

export class TournamentError extends Error {
  constructor(message, status = 400, code = 'INVALID_INPUT') {
    super(message);
    this.name = 'TournamentError';
    this.status = status;
    this.code = code;
  }
}
export function requireRule(condition, message, status = 400, code) {
  if (!condition) throw new TournamentError(message, status, code);
}
export function settingsOf(snapshot) {
  return {
    ...DEFAULT_SETTINGS,
    ...snapshot.settings,
    level_defaults: {
      ...DEFAULT_SETTINGS.level_defaults,
      ...snapshot.settings?.level_defaults
    },
    pairing_weights: {
      ...DEFAULT_SETTINGS.pairing_weights,
      ...snapshot.settings?.pairing_weights
    }
  };
}
export function nextId(rows) {
  return Math.max(0, ...rows.map(row => row.id)) + 1;
}
export function seedRating(input, settings = DEFAULT_SETTINGS) {
  if (input.has_online_rating) {
    requireRule(Number.isInteger(input.online_rating) && input.online_rating >= 100 && input.online_rating <=
      3500, 'Online rating must be between 100 and 3500.');
    return {
      seed_rating: input.online_rating - (input.rating_platform === 'lichess' ? settings.lichess_offset : 0),
      seed_source: 'online'
    };
  }
  const value = settings.level_defaults[input.level];
  requireRule(Number.isInteger(value), 'Choose a chess level.');
  return {
    seed_rating: value,
    seed_source: 'level'
  };
}
export function uniqueCode(players, draw, maxTries = 20) {
  const codes = new Set(players.map(player => player.code));
  for (let i = 0; i < maxTries; i++) {
    const code = String(draw());
    requireRule(/^[1-9]\d{3}$/.test(code), 'Code generator returned an invalid value.', 500);
    if (!codes.has(code)) return code;
  }
  throw new TournamentError('Unable to allocate a player code after 20 attempts. Contact the admin.', 503,
    'CODE_EXHAUSTED');
}
export function publicPlayer(player) {
  return {
    id: player.id,
    reg_number: player.reg_number,
    full_name: player.full_name,
    institution_type: player.institution_type,
    institution_name: player.institution_type === 'ensia' ? 'ENSIA' : player.institution_name,
    level: player.level,
    seed_rating: player.seed_rating,
    active: player.active,
    checked_in: player.checked_in
  };
}
export function publicSettings(snapshot) {
  const s = settingsOf(snapshot);
  return {
    tournament_state: s.tournament_state,
    capacity: s.capacity,
    player_count: snapshot.players.filter(p => !p.deleted_at).length,
    round_minutes: s.round_minutes,
    swiss_rounds_planned: s.show_rounds_publicly ? s.swiss_rounds_planned : null,
    knockout_size: s.show_knockout_size_publicly ? s.knockout_size : null,
    schedule: s.schedule
  };
}
export function publicRounds(snapshot) {
  return snapshot.rounds.filter(r => r.status !== 'draft');
}
export function currentRound(snapshot) {
  return [...publicRounds(snapshot)].sort((a, b) => b.number - a.number)[0] ?? null;
}
export function swissGames(snapshot, beforeRound = Infinity) {
  const rounds = new Map(publicRounds(snapshot).filter(r => r.stage === 'swiss' && r.number < beforeRound)
    .map(r => [r.id, r]));
  return snapshot.games.filter(g => g.kind === 'swiss' && g.result && rounds.has(g.round_id))
    .map(g => ({
      ...g,
      round_number: rounds.get(g.round_id).number
    })).sort((a, b) => a.round_number - b.round_number || a.id - b.id);
}
export function tieContext(snapshot) {
  return swissGames(snapshot).map(g => `${g.id}:${g.result}:${g.is_forfeit}`).join('|');
}
