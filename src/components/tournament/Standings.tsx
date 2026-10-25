'use client';
import type {
  PublicResponse,
  Standing
} from '@/lib/tournament/types';
import {
  useState
} from 'react';
import {
  motion
} from 'motion/react';
import {
  useLive
} from '@/lib/client/api';
import '@/style/tournament.css';
export default function StandingsPage() {
  const {
    payload,
    error,
    loading
  } = useLive < PublicResponse < Standing[] >> ('standings'), [query, setQuery] = useState(''), [school,
    setSchool
  ] = useState('all'), [self] = useState(() => typeof window === 'undefined' ? 0 : Number(localStorage
    .getItem('en-passant-player') || 0));

  const players = payload?.data ?? [],
    filtered = players.filter(p => p.full_name.toLowerCase().includes(query.toLowerCase()) && (school ===
      'all' || p.institution_type === school));
  return <main className="ep-shell"><p className="ep-kicker">Every player. Every round.</p><h1>Standings</h1><p className="ep-lead">Score · Buchholz · Direct encounter · Fewer byes · Armageddon</p>
    <div className="ep-toolbar"><label>Find a player<input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search by name"/></label><label>School<select value={school} onChange={event=>setSchool(event.target.value)}><option value="all">All schools</option><option value="ensia">ENSIA</option><option value="other">Other universities</option></select></label></div>
    {error && <p className="ep-error" role="alert">{error}</p>}{loading && <p>Loading standings…</p>}
    <div className="ep-card ep-table-wrap"><table><caption className="sr-only">Full Swiss standings, including withdrawn players. Equal ranks are marked with an equals sign.</caption><thead><tr><th>Rank</th><th>Player</th><th>School</th><th>Score</th><th>Buchholz</th><th>Byes</th><th>Rounds</th><th>Seed</th><th>Status</th><th>Change</th></tr></thead><tbody>{filtered.map(player=><motion.tr layout transition={{duration:0.3}} key={player.id} className={`ep-moving ${player.id === self?'ep-self':player.rank<=3?'ep-podium':''}`}><td><strong>{player.tie?'=':''}{player.rank}</strong></td><td>{player.full_name}{player.id === self?' · You':''}</td><td>{player.institution_name || 'Not provided'}</td><td><strong>{player.score}</strong></td><td>{player.buchholz}</td><td>{player.byes}</td><td>{player.history.map(item=><span key={item.round} className={`ep-chip ep-chip-${item.colour || 'none'}`} title={`Round ${item.round}: ${item.opponent?.full_name || 'bye'}${item.colour ? ' · '+item.colour:''}${item.is_forfeit?' · forfeit':''}`}>{item.colour === 'white'?'♔ ':item.colour === 'black'?'♚ ':''}{item.result}</span>)}</td><td>{player.seed_rating}</td><td>{player.status}</td><td aria-label={`Rank change ${player.rank_change}`}>{player.rank_change>0?'↑ '+player.rank_change:player.rank_change<0?'↓ '+Math.abs(player.rank_change):'—'}</td></motion.tr>)}</tbody></table>{!loading && !filtered.length && <p>No matching players.</p>}</div>
  </main>;
}
