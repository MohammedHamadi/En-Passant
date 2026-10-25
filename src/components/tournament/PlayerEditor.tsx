'use client';
import {
  useState
} from 'react';
import type {
  AdminPlayer
} from '@/lib/tournament/types';
import {
  api
} from '@/lib/client/api';
export default function PlayerEditor({
  player,
  locked,
  onDone
}: {
  player: AdminPlayer;locked: boolean;onDone: () => void
}) {
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  async function save(event: React.FormEvent < HTMLFormElement > ) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    const patch: Record < string, unknown >= {
      full_name: values.get('full_name'),
      external_id: values.get('external_id') || null,
      institution_type: values.get('institution_type') || null,
      institution_name: values.get('institution_name') || null,
      email: values.get('email') || null,
      phone: values.get('phone') || null
    };
    if (!locked) patch.seed_rating = Number(values.get('seed_rating'));
    try {
      await api(`admin/players/${player.id}`, 'PATCH', patch);
      onDone();
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  return <form className="ep-card ep-form" onSubmit={save}><h2>Edit {player.full_name}</h2><div className="ep-grid">
    <label>Full name<input name="full_name" defaultValue={player.full_name} maxLength={200} required/></label>
    <label>Seed rating<input name="seed_rating" type="number" min={0} max={3500} defaultValue={player.seed_rating} disabled={locked} required/><small>{locked?'Locked after Round 1 publication':'Admin edits override the imported seed'}</small></label>
    <label>School type<select name="institution_type" defaultValue={player.institution_type || ''}><option value="">Not provided</option><option value="ensia">ENSIA</option><option value="other">Other</option></select></label>
    <label>School name · optional<input name="institution_name" defaultValue={player.institution_name || ''} maxLength={200}/></label>
    <label>External reference · optional<input name="external_id" defaultValue={player.external_id || ''} maxLength={200}/></label>
    <label>Email · optional<input name="email" type="email" defaultValue={player.email || ''} maxLength={254}/></label>
    <label>Phone · optional<input name="phone" defaultValue={player.phone || ''} maxLength={200}/></label>
  </div>{error && <p className="ep-error" role="alert">{error}</p>}<div className="ep-actions"><button className="ep-button" disabled={busy}>Save player</button><button type="button" className="ep-secondary" onClick={onDone}>Cancel</button></div></form>;
}
