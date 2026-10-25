import {
  publicPlayer,
  swissGames,
  currentRound,
  tieContext
} from './model.mjs';

export function points(result) {
  if (result === 'white' || result === 'bye') return [1, 0];
  if (result === 'black') return [0, 1];
  if (result === 'draw') return [0.5, 0.5];
  return [0, 0];
}

function groups(rows, key) {
  const result = [];
  for (const row of rows) {
    const previous = result.at(-1);
    if (previous && key(previous[0]) === key(row)) previous.push(row);
    else result.push([row]);
  }
  return result;
}

function rankSnapshot(snapshot, beforeRound = Infinity) {
  const games = swissGames(snapshot, beforeRound);
  const rows = snapshot.players.filter(p => !p.deleted_at).map(p => ({
    ...publicPlayer(p),
    score: 0,
    buchholz: 0,
    byes: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    games: 0,
    opponents: [],
    colour_history: [],
    history: [],
    direct_encounter: 0
  }));
  const byId = new Map(rows.map(p => [p.id, p]));
  for (const game of games) {
    const white = byId.get(game.white_id),
      black = byId.get(game.black_id);
    if (!white) continue;
    if (game.result === 'bye') {
      white.score++;
      white.byes++;
      white.history.push({
        round: game.round_number,
        opponent: null,
        colour: null,
        result: 'bye',
        points: 1,
        score: white.score
      });
      continue;
    }
    if (!black) continue;
    const scores = points(game.result);
    for (const [p, other, index, colour] of [
        [white, black, 0, 'white'],
        [black, white, 1, 'black']
      ]) {
      const value = scores[index];
      p.score += value;
      p.games++;
      if (value === 1) p.wins++;
      else if (value === 0.5) p.draws++;
      else p.losses++;
      p.opponents.push(other.id);
      p.colour_history.push(colour);
      p.history.push({
        round: game.round_number,
        opponent: {
          id: other.id,
          full_name: other.full_name,
          seed_rating: other.seed_rating
        },
        colour,
        result: game.result === 'double_forfeit' ? 'FF' : value === 1 ? 'W' : value === 0.5 ? 'D' : 'L',
        is_forfeit: game.is_forfeit,
        points: value,
        score: p.score
      });
    }
  }
  // One contribution per real meeting, including a recovery rematch and a forfeit.
  for (const p of rows) p.buchholz = p.opponents.reduce((total, id) => total + (byId.get(id)?.score ?? 0), 0);
  rows.sort((a, b) => b.score - a.score || b.buchholz - a.buchholz);
  const ranked = [];
  for (const group of groups(rows, p => `${p.score}/${p.buchholz}`)) {
    const ids = new Set(group.map(p => p.id));
    const encounters = games.filter(g => g.black_id && ids.has(g.white_id) && ids.has(g.black_id));
    const complete = group.every(p => group.every(q => p.id === q.id || encounters.some(g => (g.white_id === p
      .id && g.black_id === q.id) || (g.black_id === p.id && g.white_id === q.id))));
    if (complete)
      for (const g of encounters) {
        const [w, b] = points(g.result);
        byId.get(g.white_id).direct_encounter += w;
        byId.get(g.black_id).direct_encounter += b;
      }
    group.sort((a, b) => b.direct_encounter - a.direct_encounter || a.byes - b.byes);
    for (const tied of groups(group, p => `${p.direct_encounter}/${p.byes}`)) {
      const context = tieContext(snapshot);
      const resolutions = beforeRound === Infinity ? snapshot.games.filter(g => g.kind === 'armageddon' && g
        .tie_context === context && g.result && tied.some(p => p.id === g.white_id) && tied.some(p => p
          .id === g.black_id)) : [];
      let remaining = [...tied];
      while (remaining.length) {
        const eligible = new Set(remaining.map(p => p.id));
        const losers = new Set(resolutions.filter(g => eligible.has(g.white_id) && eligible.has(g.black_id))
          .map(g => g.result === 'white' ? g.black_id : g.white_id));
        let tier = remaining.filter(p => !losers.has(p.id));
        // Cycles cannot turn contradictory resolutions into an arbitrary rank.
        if (!tier.length) tier = remaining;
        tier.sort((a, b) => b.seed_rating - a.seed_rating || a.id - b.id);
        const rank = ranked.length + 1;
        for (const p of tier) ranked.push({
          ...p,
          rank,
          tie: tier.length > 1
        });
        const selected = new Set(tier.map(p => p.id));
        remaining = remaining.filter(p => !selected.has(p.id));
      }
    }
  }
  return ranked;
}
export function standings(snapshot) {
  const ranked = rankSnapshot(snapshot);
  const round = currentRound(snapshot);
  const previous = round ? new Map(rankSnapshot(snapshot, round.number).map(p => [p.id, p.rank])) : new Map();
  return ranked.map(p => {
    const game = round && snapshot.games.find(g => g.round_id === round.id && g.kind === 'swiss' && (g
      .white_id === p.id || g.black_id === p.id));
    return {
      ...p,
      rank_change: previous.has(p.id) ? previous.get(p.id) - p.rank : 0,
      status: !p.active ? 'withdrawn' : game?.result === 'bye' ? 'bye' : game?.result ? 'finished' :
        game && round.status === 'running' ? 'playing' : 'waiting'
    };
  });
}
