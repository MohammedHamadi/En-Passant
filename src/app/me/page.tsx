'use client';
import type {
  MeView
} from '@/lib/tournament/types';
import {
  useEffect,
  useState
} from 'react';
import {
  api
} from '@/lib/client/api';
import Countdown from '@/components/tournament/Countdown';
import '@/style/tournament.css';

function rememberedCode() {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem('en-passant-code') || '';
  } catch {
    return '';
  }
}
export default function MyMatchPage() {
  const [typed, setTyped] = useState(rememberedCode), [code, setCode] = useState(rememberedCode), [view,
      setView
    ] = useState <
    MeView | null > (null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [offset,
      setOffset
    ] =
    useState(0);

  useEffect(() => {
    if (!code) return;
    let stopped = false;
    let timer: ReturnType < typeof setTimeout > ;
    async function refresh() {
      const start = Date.now();
      let delay = 5000;
      try {
        const data = await api < MeView > ('me', 'POST', {
          code
        });
        if (!stopped) {
          setView(data);
          setError('');
          setOffset(Date.parse(data.server_time) - (start + Date.now()) / 2);
        }
      } catch (error) {
        if (!stopped) {
          setError(error.message);
          delay = Math.max(5000, (error.retryAfter || 0) * 1000);
          if (error.status === 401) {
            setView(null);
            setCode('');
            localStorage.removeItem('en-passant-code');
          }
        }
      }
      if (!stopped) timer = setTimeout(refresh, delay);
    }
    void refresh();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [code]);
  async function lookup(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const start = Date.now();
    try {
      const data = await api < MeView > ('me', 'POST', {
        code: typed
      });
      setView(data);
      setOffset(Date.parse(data.server_time) - (start + Date.now()) / 2);
      setCode(typed);
      localStorage.setItem('en-passant-code', typed);
      localStorage.setItem('en-passant-player', String(data.player.id));
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  const match = view?.match,
    round = view?.round;
  const banner = !match ? 'Waiting for pairings' : match.result === 'bye' ?
    'You have a bye this round (1 point)' : match.result ? 'Result recorded' : round?.status === 'running' ?
    'Game in progress' : `Go to Table ${match.table_number}`;
  return <main className="ep-shell ep-narrow"><p className="ep-kicker">Your tournament companion</p><h1>My match</h1>
    {!view && <form onSubmit={lookup} className="ep-card ep-form"><label>Your four-digit player code<input value={typed} onChange={event=>setTyped(event.target.value.replace(/\D/g,'').slice(0,4))} inputMode="numeric" autoComplete="off" pattern="[1-9][0-9]{3}" maxLength={4} required className="ep-code-input"/></label><button className="ep-button" disabled={busy}>{busy?'Looking up…':'Find my match'}</button><p>Use the player code provided by the organisers. Lost it? Ask the check-in desk.</p></form>}
    {error && <p className="ep-error" role="alert">{error}</p>}
    {view && <><div className="ep-row"><h2>{view.player.full_name}</h2><button className="ep-secondary" onClick={()=>{setCode('');setView(null);localStorage.removeItem('en-passant-code');localStorage.removeItem('en-passant-player');}}>Use another code</button></div><p className="ep-banner" role="status">{banner}</p>
      <div className="ep-card ep-match"><div className="ep-row"><span>{round ? `Round ${round.number}`:'Round to be announced'}</span><strong><Countdown round={round} offset={offset}/></strong></div>
        {match?.opponent && <><p className="ep-kicker">Your table</p><div className="ep-table-number">{match.table_number}</div><h2>vs {match.opponent.full_name}</h2><p>Seed rating {match.opponent.seed_rating}</p><p className="ep-colour">{match.colour === 'white'?'♔ White':'♚ Black'}</p></>}
        {match?.result === 'bye' && <><div className="ep-table-number">+1</div><p>No table this round. Your bye adds one point.</p></>}
        {!match && <p>Your next opponent and table appear after pairings are published.</p>}
      </div><div className="ep-grid"><div className="ep-card"><p>Your score</p><strong className="ep-stat">{view.player.score}</strong></div><div className="ep-card"><p>Your rank</p><strong className="ep-stat">{view.player.tie?'=':''}{view.player.rank}</strong></div></div>
      <div className="ep-card"><h2>Your history</h2><div className="ep-table-wrap"><table><thead><tr><th>Round</th><th>Opponent</th><th>Colour</th><th>Result</th></tr></thead><tbody>{view.player.history.map(item=><tr key={item.round}><td>{item.round}</td><td>{item.opponent?.full_name || 'Bye'}</td><td>{item.colour || '—'}</td><td>{item.result}{item.is_forfeit?' · forfeit':''}</td></tr>)}</tbody></table></div></div></>}
  </main>;
}
