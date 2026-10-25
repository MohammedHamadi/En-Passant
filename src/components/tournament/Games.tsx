'use client';
import type {
  PublicResponse,
  PublishedGame,
  PublicRound
} from '@/lib/tournament/types';
import {
  useState
} from 'react';
import {
  useLive
} from '@/lib/client/api';
import Countdown from './Countdown';
import '@/style/tournament.css';
export default function GamesPage() {
  const {
    payload,
    error,
    loading
  } = useLive < PublicResponse < PublishedGame[] >> ('games'), {
    payload: current,
    offset
  } = useLive < PublicResponse < PublicRound >> ('rounds/current'), [selected, setSelected] = useState(0);
  const games = payload?.data ?? [],
    rounds = [...new Set < number > (games.map(g => g.round))].sort((a, b) => b - a),
    number = selected || rounds[0];
  return <main className="ep-shell"><p className="ep-kicker">Published pairings & results</p><h1>Tables & matches</h1><div className="ep-row"><label>Round<select value={number || ''} onChange={event=>setSelected(Number(event.target.value))}>{rounds.map(r=><option key={r} value={r}>Round {r}</option>)}</select></label><strong><Countdown round={current?.data} offset={offset}/></strong></div>
    {error && <p className="ep-error" role="alert">{error}</p>}{loading && <p>Loading games…</p>}{!loading && !games.length && <p className="ep-banner">Waiting for published pairings.</p>}
    {games.filter(g=>g.round === number).sort((a,b)=>(a.table_number ?? Infinity)-(b.table_number ?? Infinity)).map(game=><div key={game.id} className="ep-card ep-row"><div><p className="ep-kicker">{game.black ? `Table ${game.table_number}`:'Bye · 1 point'}</p><h2>{game.white.full_name}{game.black && ` vs ${game.black.full_name}`}</h2><p>{game.black ? `♔ White: ${game.white.seed_rating} · ♚ Black: ${game.black.seed_rating}`:'No table this round'}</p></div><strong>{game.result === 'white'?'1–0':game.result === 'black'?'0–1':game.result === 'draw'?'½–½':game.result === 'double_forfeit'?'0–0 · double forfeit':game.result === 'bye'?'+1':game.round_status === 'running'?'Playing':'Not started'}{game.is_forfeit && game.result !== 'double_forfeit'?' · forfeit':''}</strong></div>)}
  </main>;
}
