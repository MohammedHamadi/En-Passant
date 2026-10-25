'use client';
import type {
  AdminState,
  AdminPlayer,
  AuditEntry,
  Game,
  GameResult,
  Round
} from '@/lib/tournament/types';
import {
  useState
} from 'react';
import {
  api,
  useLive
} from '@/lib/client/api';
import PlayerIntake from './PlayerIntake';
import PlayerEditor from './PlayerEditor';
import Countdown from './Countdown';
import '@/style/tournament.css';

const RESULT_OPTIONS: [GameResult, string][] = [
  ['white', '1–0'],
  ['draw', '½–½'],
  ['black', '0–1']
];

function ResultEntry({
  game,
  round,
  main,
  run,
  disabled,
  players
}: {
  game: Game;round: Round;main: boolean;run: (path: string, method ? : string, body ? : unknown) =>
    Promise <
    void > ;disabled: boolean;players: AdminPlayer[]
}) {
  const [ack, setAck] = useState(false), [notes, setNotes] = useState(game.notes || ''), [pgn, setPgn] =
    useState(game.pgn || ''), [moves, setMoves] = useState(game.moves_count ?? '');
  const white = players.find(p => p.id === game.white_id),
    black = players.find(p => p.id === game.black_id),
    editable = round.status === 'running' || main && round.status === 'closed';
  const save = (result: GameResult, is_forfeit = false) => run(`admin/games/${game.id}`, 'PATCH', {
    result,
    is_forfeit,
    acknowledge_later_rounds: ack,
    notes,
    pgn,
    moves_count: moves === '' ? null : Number(moves)
  });
  return <div className="ep-card"><div className="ep-row"><div><p className="ep-kicker">{black?`Table ${game.table_number}`:'Bye · 1 point'}</p><h2>{white?.full_name}{black && ` vs ${black.full_name}`}</h2><small>{black?'♔ '+white?.seed_rating+' · ♚ '+black?.seed_rating:'No table assigned'}</small></div><strong>{game.result || 'Awaiting result'}{game.is_forfeit?' · forfeit':''}</strong></div>
    {black && editable && <><div className="ep-actions">{RESULT_OPTIONS.map(([result,label])=><button key={result} disabled={disabled} className={game.result === result && !game.is_forfeit?'ep-button':'ep-secondary'} onClick={()=>save(result)}>{label}</button>)}<button className="ep-secondary" disabled={disabled} onClick={()=>save('white',true)}>White wins by forfeit</button><button className="ep-secondary" disabled={disabled} onClick={()=>save('black',true)}>Black wins by forfeit</button><button className="ep-danger" disabled={disabled} onClick={()=>save('double_forfeit',true)}>Double forfeit · 0–0</button><button className="ep-secondary" disabled={disabled} onClick={()=>save(null)}>Clear result</button></div>
      {round.status === 'closed' && <label className="ep-check"><input type="checkbox" checked={ack} onChange={e=>setAck(e.target.checked)}/>I have reviewed any later published pairings affected by this correction.</label>}
      <details><summary>Game annotations</summary><div className="ep-form"><label>Notes<textarea value={notes} onChange={e=>setNotes(e.target.value)} maxLength={5000}/></label><label>PGN<textarea value={pgn} onChange={e=>setPgn(e.target.value)} maxLength={100000}/></label><label>Moves<input type="number" min={0} max={10000} value={moves} onChange={e=>setMoves(e.target.value)}/></label><button className="ep-secondary" disabled={disabled} onClick={()=>save(game.result,game.is_forfeit)}>Save annotations</button></div></details>
    </>}
  </div>;
}
export default function AdminPage() {
  const [plannedStart, setPlannedStart] = useState('');
  const {
    payload: state,
    error: loadError,
    loading,
    reload,
    offset
  } = useLive < AdminState > ('admin/state'), [busy, setBusy] = useState(false), [error, setError] = useState(
      ''), [query,
      setQuery
    ] = useState(''), [school, setSchool] = useState('all'), [status, setStatus] = useState('all'), [editing,
      setEditing
    ] = useState < AdminPlayer | null > (null), [selectedRound, setSelectedRound] = useState(0), [swapA,
      setSwapA
    ] =
    useState(''), [swapB, setSwapB] = useState(''), [armWhite, setArmWhite] = useState(''), [armBlack,
      setArmBlack
    ] = useState(''), [armResult, setArmResult] = useState('white'), [audit, setAudit] = useState <
    AuditEntry[] > (
      []);
  async function run(path: string, method = 'POST', body: unknown = {}) {
    setBusy(true);
    setError('');
    try {
      await api(path, method, method === 'DELETE' ? undefined : body);
      await reload();
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  if (loading) return <main className="ep-shell"><p>Loading admin panel…</p></main>;
  if (!state)
    return <main className="ep-shell"><p className="ep-error" role="alert">{loadError || 'Unable to load admin panel.'}</p><a href="/login">Sign in</a></main>;
  const main = state.role === 'admin',
    players = state.players.filter(p => !p.deleted_at),
    latest = [...state.rounds].sort((a, b) => b.number - a.number)[0],
    round = state.rounds.find(r => r.id === selectedRound) || latest,
    locked = state.settings.ratings_locked || state.rounds.some(r => r.number === 1 && r.status !== 'draft'),
    games = state.games.filter(g => g.round_id === round?.id && g.kind === 'swiss'),
    tied = state.standings.filter(p => p.tie),
    settings = state.settings;
  const filtered = players.filter(p => p.full_name.toLowerCase().includes(query.toLowerCase()) && (school ===
    'all' || p.institution_type === school) && (status === 'all' || status === 'checked' && p
    .checked_in || status === 'waiting' && !p.checked_in || status === 'withdrawn' && !p.active));
  async function saveSettings(event: React.FormEvent < HTMLFormElement > ) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    await run('admin/settings', 'PATCH', {
      capacity: Number(values.get('capacity')),
      round_minutes: Number(values.get('round_minutes')),
      late_forfeit_minutes: Number(values.get('late_forfeit_minutes')),
      lichess_offset: Number(values.get('lichess_offset')),
      round1_method: values.get('round1_method'),
      swiss_rounds_planned: values.get('swiss_rounds_planned') ? Number(values.get(
        'swiss_rounds_planned')) : null,
      show_rounds_publicly: values.get('show_rounds_publicly') === 'on'
    });
  }
  return <main className="ep-shell"><div className="ep-row"><div><p className="ep-kicker">En Passant · tournament desk</p><h1>Admin panel</h1></div><div><p>{settings.tournament_state.replaceAll('_',' ')}</p><button className="ep-secondary" onClick={async()=>{await api('admin/logout','POST',{});window.location.href='/login';}}>Sign out</button></div></div>
    {(error || loadError) && <p className="ep-error" role="alert">{error || loadError}</p>}
    <div className="ep-grid"><div className="ep-card"><p>Players in roster</p><strong className="ep-stat">{players.length}</strong></div><div className="ep-card"><p>Checked in & active</p><strong className="ep-stat">{players.filter(p=>p.checked_in && p.active).length}</strong></div><div className="ep-card"><p>Current round</p><strong className="ep-stat">{latest?.number || '—'}</strong></div></div>
    {main && <><details className="ep-card"><summary>Tournament settings</summary>
      <form className="ep-form" onSubmit={saveSettings}><div className="ep-grid"><label>Player limit<input name="capacity" type="number" min={2} max={9000} defaultValue={settings.capacity} required/></label><label>Round duration · minutes<input name="round_minutes" type="number" min={1} max={180} defaultValue={settings.round_minutes} required/></label><label>Late forfeit · minutes<input name="late_forfeit_minutes" type="number" min={0} max={60} defaultValue={settings.late_forfeit_minutes} required/></label><label>Lichess offset<input name="lichess_offset" type="number" min={0} max={1000} defaultValue={settings.lichess_offset} required/></label><label>Swiss rounds planned<input name="swiss_rounds_planned" type="number" min={1} max={20} defaultValue={settings.swiss_rounds_planned || ''}/></label><label>Round 1 method<select name="round1_method" defaultValue={settings.round1_method}><option value="closest">Closest ratings</option><option value="top_half">Top half vs bottom half</option></select></label></div><label className="ep-check"><input type="checkbox" name="show_rounds_publicly" defaultChecked={settings.show_rounds_publicly}/>Announce the number of Swiss rounds publicly</label><button className="ep-button" disabled={busy}>Save settings</button></form></details>
      <details open className="ep-card"><summary>Upload players</summary><PlayerIntake onSuccess={()=>void reload()}/></details>
      <div className="ep-toolbar"><label>Find a player<input type="search" value={query} onChange={e=>setQuery(e.target.value)}/></label><label>School<select value={school} onChange={e=>setSchool(e.target.value)}><option value="all">All schools</option><option value="ensia">ENSIA</option><option value="other">Other</option></select></label><label>Status<select value={status} onChange={e=>setStatus(e.target.value)}><option value="all">All players</option><option value="checked">Checked in</option><option value="waiting">Not checked in</option><option value="withdrawn">Withdrawn</option></select></label></div>
      <div className="ep-card ep-table-wrap"><table><thead><tr><th>No.</th><th>Player</th><th>School</th><th>Seed</th><th>Code</th><th>Check-in</th><th>Actions</th></tr></thead><tbody>{filtered.map(p=><tr key={p.id}><td>{p.reg_number}</td><td>{p.full_name}<br/><small>{p.level || p.rating_platform || 'Imported player'} · {p.active?'active':'withdrawn'}</small></td><td>{p.institution_type === 'ensia'?'ENSIA':p.institution_name}</td><td>{p.seed_rating}</td><td><button className="ep-secondary" title="Copy player code" onClick={()=>{void navigator.clipboard.writeText(p.code).catch(()=>setError('Copy unavailable. The code is displayed on the button.'));}}>{p.code}</button></td><td><button className="ep-secondary" disabled={busy || !p.active} onClick={()=>run(`admin/players/${p.id}`,'PATCH',{checked_in:!p.checked_in})}>{p.checked_in?'✓ Present':'Check in'}</button></td><td><div className="ep-actions"><button className="ep-secondary" onClick={()=>setEditing(p)}>Edit</button><button className="ep-secondary" disabled={busy} onClick={()=>{if(confirm('Generate a new code? The previous code will stop working.'))void run(`admin/players/${p.id}/regenerate-code`);}}>New code</button><button className="ep-secondary" disabled={busy} onClick={()=>{if(confirm(p.active?'Withdraw this player? A running game becomes a forfeit.':'Reactivate this player?'))void run(`admin/players/${p.id}`,'PATCH',{active:!p.active});}}>{p.active?'Withdraw':'Restore'}</button><button className="ep-danger" disabled={busy} onClick={()=>{if(confirm('Delete this player? Players with games must be withdrawn instead.'))void run(`admin/players/${p.id}`,'DELETE');}}>Delete</button></div></td></tr>)}</tbody></table></div>
      {editing && <PlayerEditor key={editing.id} player={editing} locked={locked} onDone={()=>{setEditing(null);void reload();}}/>}
    </>}
    <section className="ep-card"><div className="ep-row"><h2>Rounds & results</h2>{main && <button className="ep-button" disabled={busy || latest && latest.status !== 'closed' || !['check_in','swiss'].includes(settings.tournament_state)} onClick={()=>run('admin/rounds/generate')}>Generate draft round</button>}</div>
      {round && <><div className="ep-row"><label>Round<select value={round.id} onChange={e=>setSelectedRound(Number(e.target.value))}>{state.rounds.map(r=><option key={r.id} value={r.id}>Round {r.number} · {r.status}</option>)}</select></label><strong><Countdown round={round} offset={offset}/></strong></div>
        {round.invalidated && <p className="ep-error">This draft is stale after a player or result change. Delete it and generate again.</p>}{round.warnings?.map((warning,i)=><p className="ep-banner" key={i}>{warning}</p>)}
        {main && round.status === 'draft' && <label>Planned start · Algiers time<input type="datetime-local" value={plannedStart} onChange={e=>setPlannedStart(e.target.value)}/></label>}
        {main && <div className="ep-actions">{round.status === 'draft' && <button disabled={busy || round.invalidated} className="ep-button" onClick={()=>run(`admin/rounds/${round.id}/publish`, 'POST', {planned_start: plannedStart ? new Date(plannedStart+'+01:00').toISOString() : null})}>Publish pairings</button>}{round.status === 'published' && <button disabled={busy} className="ep-button" onClick={()=>run(`admin/rounds/${round.id}/start`)}>Start {round.duration_minutes}-minute round</button>}{round.status === 'running' && <button disabled={busy || games.some(g=>!g.result)} className="ep-button" onClick={()=>run(`admin/rounds/${round.id}/close`)}>Close round</button>}{round.id === latest?.id && <button className="ep-danger" disabled={busy} onClick={()=>{if(confirm(`Delete Round ${round.number} and its games?`))void run(`admin/rounds/${round.id}`,'DELETE');}}>Delete last round</button>}</div>}
        {main && round.status === 'draft' && <form className="ep-form" onSubmit={event=>{event.preventDefault();void run(`admin/rounds/${round.id}/swap`,'POST',{player_a:Number(swapA),player_b:Number(swapB)});}}><div className="ep-grid"><label>Swap player<select required value={swapA} onChange={e=>setSwapA(e.target.value)}><option value="">Choose player</option>{players.filter(p=>games.some(g=>g.white_id === p.id || g.black_id === p.id)).map(p=><option key={p.id} value={p.id}>{p.full_name}</option>)}</select></label><label>With player<select required value={swapB} onChange={e=>setSwapB(e.target.value)}><option value="">Choose player</option>{players.filter(p=>games.some(g=>g.white_id === p.id || g.black_id === p.id)).map(p=><option key={p.id} value={p.id}>{p.full_name}</option>)}</select></label></div><button className="ep-secondary" disabled={busy || round.invalidated}>Swap & check warnings</button></form>}
      </>}
    </section>
    {games.sort((a,b)=>(a.table_number ?? Infinity)-(b.table_number ?? Infinity)).map(game=><ResultEntry key={`${game.id}-${game.updated_at}`} game={game} round={round} main={main} run={run} disabled={busy} players={players}/>)}
    {main && <><details className="ep-card"><summary>Resolve a standings tie with Armageddon</summary><p>Record the colours drawn by lots. White has 5 minutes, Black 4; Black wins on a draw. This does not change Swiss scores.</p><form className="ep-form" onSubmit={event=>{event.preventDefault();void run('admin/armageddon','POST',{white_id:Number(armWhite),black_id:Number(armBlack),result:armResult});}}><div className="ep-grid"><label>White<select value={armWhite} required onChange={e=>setArmWhite(e.target.value)}><option value="">Choose tied player</option>{tied.map(p=><option value={p.id} key={p.id}>{p.rank}= · {p.full_name}</option>)}</select></label><label>Black<select value={armBlack} required onChange={e=>setArmBlack(e.target.value)}><option value="">Choose tied player</option>{tied.map(p=><option value={p.id} key={p.id}>{p.rank}= · {p.full_name}</option>)}</select></label><label>Result<select value={armResult} onChange={e=>setArmResult(e.target.value)}><option value="white">White wins</option><option value="black">Black wins</option><option value="draw">Draw · Black wins tie-break</option></select></label></div><button className="ep-button" disabled={busy}>Record tie-break</button></form></details>
      <details className="ep-card"><summary>Audit history</summary><button className="ep-secondary" onClick={async()=>{try{setAudit(await api<AuditEntry[]>('admin/audit'));}catch(error){setError(error.message);}}}>Load latest changes</button>{audit.map(row=><details key={row.id}><summary>{new Date(row.created_at).toLocaleString('en-GB',{timeZone:'Africa/Algiers'})} · {row.actor} · {row.action}</summary><pre>{JSON.stringify({old_value:row.old_value,new_value:row.new_value},null,2)}</pre></details>)}</details>
    </>}
  </main>;
}
