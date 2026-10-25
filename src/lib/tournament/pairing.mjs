import blossom from './vendor/blossom.cjs';
import {
  requireRule,
  DEFAULT_SETTINGS
} from './model.mjs';

export function colourNeed(player) {
  const h = player.colour_history ?? [],
    last = h.at(-1),
    imbalance = h.filter(c => c === 'white').length - h.filter(c => c === 'black').length;
  if (last && h.at(-2) === last) return {
    colour: last === 'white' ? 'black' : 'white',
    strength: 2,
    imbalance
  };
  if (Math.abs(imbalance) >= 2) return {
    colour: imbalance > 0 ? 'black' : 'white',
    strength: 2,
    imbalance
  };
  return {
    colour: imbalance ? imbalance > 0 ? 'black' : 'white' : last ? last === 'white' ? 'black' : 'white' :
      null,
    strength: last ? 1 : 0,
    imbalance
  };
}
export function penalty(a, b, weights = DEFAULT_SETTINGS.pairing_weights) {
  const x = colourNeed(a),
    y = colourNeed(b);
  let value = weights.rating * Math.abs(a.seed_rating - b.seed_rating) / 100 + weights.score_gap * Math.abs(a
    .score - b.score);
  if (x.colour && x.colour === y.colour) value += x.strength === 2 && y.strength === 2 ? weights.both_must : x
    .strength === 2 || y.strength === 2 ? weights.must_prefer : weights.both_prefer;
  if (a.opponents.includes(b.id) || b.opponents.includes(a.id)) value += weights.rematch;
  return value;
}
export function assignColours(a, b, table = null) {
  if (table != null) {
    const higher = a.seed_rating > b.seed_rating || a.seed_rating === b.seed_rating && a.id < b.id ? a : b;
    const white = table % 2 === 1 ? higher : higher.id === a.id ? b : a;
    return {
      white,
      black: white.id === a.id ? b : a,
      warning: null
    };
  }
  const x = colourNeed(a),
    y = colourNeed(b);
  const chosen = [
    [a, x],
    [b, y]
  ].sort((u, v) => v[1].strength - u[1].strength || Math.abs(v[1].imbalance) - Math.abs(u[1].imbalance) ||
    v[0].seed_rating - u[0].seed_rating || u[0].id - v[0].id)[0];
  const white = chosen[1].colour === 'black' ? chosen[0].id === a.id ? b : a : chosen[0];
  return {
    white,
    black: white.id === a.id ? b : a,
    warning: x.strength === 2 && y.strength === 2 && x.colour === y.colour ?
      `Conflicting forced colours for ${a.full_name} and ${b.full_name}.` : null
  };
}

function repeated(a, b) {
  return a.opponents.includes(b.id) || b.opponents.includes(a.id);
}

function perfect(pool, allowRematches, weights, expired) {
  if (expired()) throw new Error('PAIRING_TIMEOUT');
  if (!pool.length) return [];
  const [first, ...rest] = pool;
  const candidates = rest.filter(p => allowRematches || !repeated(first, p)).sort((a, b) => penalty(first, a,
    weights) - penalty(first, b, weights) || a.id - b.id).slice(0, 6);
  for (const candidate of candidates) {
    const sub = perfect(rest.filter(p => p.id !== candidate.id), allowRematches, weights, expired);
    if (sub) return [
      [first, candidate], ...sub
    ];
  }
  return null;
}

function weightedMatching(pool, allowRematches, weights) {
  if (!pool.length) return [];
  const edges = [];
  for (let i = 0; i < pool.length; i++)
    for (let j = i + 1; j < pool.length; j++) {
      if (allowRematches || !repeated(pool[i], pool[j])) edges.push([i, j, Math.round(penalty(pool[i],
        pool[j], weights) * 100)]);
    }
  const ceiling = Math.max(0, ...edges.map(edge => edge[2])) + 1;
  for (const edge of edges) edge[2] = ceiling - edge[2];
  const mates = blossom(edges, true);
  if (pool.some((_, i) => mates[i] == null || mates[i] < 0)) return null;
  return pool.flatMap((p, i) => mates[i] > i ? [
    [p, pool[mates[i]]]
  ] : []);
}
export function tableSort(a, b) {
  return Math.max(b[0].score, b[1].score) - Math.max(a[0].score, a[1].score) || b[0].score + b[1].score - a[0]
    .score - a[1].score || b[0].seed_rating + b[1].seed_rating - a[0].seed_rating - a[1].seed_rating || Math
    .min(a[0].id, a[1].id) - Math.min(b[0].id, b[1].id);
}
export function pairingWarnings(games, players) {
  const byId = new Map(players.map(p => [p.id, p])),
    warnings = [];
  for (const game of games) {
    if (game.black_id == null) continue;
    const a = byId.get(game.white_id),
      b = byId.get(game.black_id);
    if (repeated(a, b)) warnings.push(`Rematch: ${a.full_name} / ${b.full_name}.`);
    if (colourNeed(a).strength === 2 && colourNeed(a).colour !== 'white') warnings.push(
      `${a.full_name} needs Black.`);
    if (colourNeed(b).strength === 2 && colourNeed(b).colour !== 'black') warnings.push(
      `${b.full_name} needs White.`);
  }
  return warnings;
}
export function assertPairings(games, pool) {
  const ids = games.flatMap(g => g.black_id == null ? [g.white_id] : [g.white_id, g.black_id]);
  requireRule(ids.length === pool.length && new Set(ids).size === pool.length && pool.every(p => ids.includes(
    p.id)), 'Pairings must contain every eligible player exactly once.');
  requireRule(games.length === Math.ceil(pool.length / 2), 'Incomplete round.');
  requireRule(games.filter(g => g.black_id == null).length === pool.length % 2, 'Invalid bye count.');
}
export function generatePairings(players, settings = DEFAULT_SETTINGS, {
  now = () => performance.now(),
  timeoutMs = 2000
} = {}) {
  const pool = players.filter(p => p.active && p.checked_in),
    weights = settings.pairing_weights ?? DEFAULT_SETTINGS.pairing_weights;
  requireRule(pool.length >= 2, 'At least two active, checked-in players are required.');
  const firstRound = settings.round_number != null ? settings.round_number === 1 : pool.every(p => p.history
    .length === 0);
  const sorted = [...pool].sort((a, b) => a.rank - b.rank || b.seed_rating - a.seed_rating || a.id - b.id);
  const bye = pool.length % 2 ? [...pool].sort((a, b) => a.byes - b.byes || a.score - b.score || a.buchholz -
    b.buchholz || a.seed_rating - b.seed_rating || a.id - b.id)[0] : null;
  const working = sorted.filter(p => p.id !== bye?.id),
    start = now(),
    expired = () => now() - start >= timeoutMs;
  let pairs = [],
    floaters = [],
    fallback = false,
    recovery = false;
  try {
    if (firstRound && settings.round1_method === 'top_half') {
      const seeds = [...working].sort((a, b) => b.seed_rating - a.seed_rating || a.id - b.id),
        half = seeds.length / 2;
      pairs = seeds.slice(0, half).map((p, i) => [p, seeds[half + i]]);
    } else {
      const scores = [...new Set(working.map(p => p.score))].sort((a, b) => b - a);
      for (const score of scores) {
        const bracket = [...floaters, ...working.filter(p => p.score === score)];
        floaters = [];
        let found = bracket.length % 2 === 0 ? perfect(bracket, false, weights, expired) : null;
        if (bracket.length % 2) {
          for (let i = bracket.length - 1; i >= 0; i--) {
            found = perfect(bracket.filter((_, j) => i !== j), false, weights, expired);
            if (found) {
              floaters = [bracket[i]];
              break;
            }
          }
        }
        if (found) pairs.push(...found);
        else floaters = bracket;
      }
      if (floaters.length) {
        // Try the entire pool strictly before introducing any recovery rematch.
        const strict = weightedMatching(working, false, weights);
        if (strict) pairs = strict;
        else {
          recovery = true;
          pairs = weightedMatching(working, true, weights);
        }
      }
    }
  } catch (error) {
    if (error.message !== 'PAIRING_TIMEOUT') throw error;
    fallback = true;
    pairs = weightedMatching(working, false, weights);
    if (!pairs) {
      recovery = true;
      pairs = weightedMatching(working, true, weights);
    }
  }
  requireRule(pairs != null, 'Unable to construct a complete round. Nothing was saved.');
  // Revisit bracket floats when a forced-colour conflict can be avoided globally.
  // The same weights and rematch rules apply; this never creates a normal-pass rematch.
  const conflicts = list => list.filter(([a, b]) => {
    const x = colourNeed(a),
      y = colourNeed(b);
    return x.strength === 2 && y.strength === 2 && x.colour === y.colour;
  }).length;
  if (!firstRound && conflicts(pairs)) {
    const repaired = weightedMatching(working, recovery, weights);
    if (repaired && conflicts(repaired) < conflicts(pairs)) pairs = repaired;
  }
  pairs.sort(tableSort);
  const warnings = [],
    games = pairs.map(([a, b], i) => {
      const {
        white,
        black,
        warning
      } = assignColours(a, b, firstRound ? i + 1 : null);
      if (warning) warnings.push(warning);
      return {
        white_id: white.id,
        black_id: black.id,
        table_number: i + 1,
        result: null,
        is_forfeit: false,
        kind: 'swiss'
      };
    });
  if (bye) games.push({
    white_id: bye.id,
    black_id: null,
    table_number: null,
    result: 'bye',
    is_forfeit: false,
    kind: 'swiss'
  });
  assertPairings(games, pool);
  warnings.push(...pairingWarnings(games, pool));
  return {
    games,
    warnings: [...new Set(warnings)],
    fallback,
    recovery
  };
}
