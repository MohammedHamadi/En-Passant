'use client';
import {
  useState
} from 'react';
import {
  api
} from '@/lib/client/api';
import type {
  ImportPreview,
  ImportSummary
} from '@/lib/tournament/types';

export default function PlayerIntake({
  onSuccess
}: {
  onSuccess: () => void
}) {
  const [csv, setCSV] = useState(''), [fileName, setFileName] = useState(''), [preview, setPreview] =
    useState < ImportPreview | null > (null), [result, setResult] = useState < ImportSummary | null > (null),
    [error, setError] = useState(''), [busy, setBusy] = useState(false);
  async function choose(file ? : File) {
    setPreview(null);
    setResult(null);
    setError('');
    setCSV('');
    setFileName(file?.name || '');
    if (!file) return;
    if (file.size > 750000) {
      setError('Use a CSV file smaller than 750 KB.');
      return;
    }
    try {
      setCSV(await file.text());
    } catch {
      setError('Unable to read this file.');
    }
  }
  async function inspect() {
    setBusy(true);
    setError('');
    setResult(null);
    try {
      setPreview(await api < ImportPreview > ('admin/players/import/preview', 'POST', {
        csv
      }));
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  async function upload() {
    setBusy(true);
    setError('');
    try {
      setResult(await api < ImportSummary > ('admin/players/import', 'POST', {
        csv
      }));
      setPreview(null);
      onSuccess();
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  async function add(event: React.FormEvent < HTMLFormElement > ) {
    event.preventDefault();
    const form = event.currentTarget,
      values = new FormData(form);
    setBusy(true);
    setError('');
    setResult(null);
    try {
      await api('admin/players', 'POST', {
        full_name: values.get('full_name'),
        seed_rating: Number(values.get('seed_rating')),
        institution_type: values.get('institution_type') || null,
        institution_name: values.get('institution_name') || null,
        external_id: values.get('external_id') || null,
        code: values.get('code') || null
      });
      form.reset();
      setPreview(null);
      onSuccess();
      setResult({
        total: 1,
        added: 1,
        skipped: 0,
        invalid: 0
      });
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  return <div className="ep-form"><p>Upload the player export from your registration platform. Existing roster entries are skipped; an upload never overwrites results or player history.</p>
    <label>Player CSV<input type="file" accept=".csv,text/csv" disabled={busy} onChange={event=>void choose(event.target.files?.[0])}/></label>
    <p><a href="/players-template.csv" download>Download a CSV template</a>. Required: name. Optional: rating, school, external reference, contact details and player code. Missing ratings default to 1200; missing codes are assigned automatically.</p>
    <button className="ep-secondary" disabled={busy || !csv} onClick={inspect}>{busy?'Working…':`Preview ${fileName || 'upload'}`}</button>
    {preview && <><p className="ep-banner">{preview.summary.added} new · {preview.summary.skipped} duplicates · {preview.summary.invalid} invalid</p>{preview.error && <p className="ep-error">{preview.error}</p>}{preview.unused_columns.length>0 && <p>Unused columns: {preview.unused_columns.join(', ')}</p>}
      <div className="ep-table-wrap"><table><thead><tr><th>Row</th><th>Player</th><th>Seed</th><th>Action</th><th>Details</th></tr></thead><tbody>{preview.rows.slice(0,30).map(row=><tr key={row.row}><td>{row.row}</td><td>{row.name || '—'}</td><td>{row.player?.seed_rating ?? '—'}</td><td>{row.status}</td><td>{row.reason || (row.player?.code?'Use supplied code':'Assign a player code')}</td></tr>)}</tbody></table></div>{preview.rows.length>30 && <p>Showing the first 30 rows. All rows are validated before upload.</p>}
      <button className="ep-button" disabled={busy || !preview.can_import || preview.summary.added===0} onClick={upload}>Upload {preview.summary.added} players</button></>}
    {result && <p className="ep-banner" role="status">Added {result.added} player{result.added===1?'':'s'}. Skipped {result.skipped} duplicate{result.skipped===1?'':'s'}.</p>}
    {error && <p className="ep-error" role="alert">{error}</p>}
    <details><summary>Add one player / walk-in</summary><form className="ep-form" onSubmit={add}><div className="ep-grid">
      <label>Full name<input name="full_name" maxLength={200} required/></label><label>Seed rating<input name="seed_rating" type="number" min={0} max={3500} defaultValue={1200} required/></label>
      <label>School type<select name="institution_type"><option value="">Not provided</option><option value="ensia">ENSIA</option><option value="other">Other</option></select></label><label>School name · optional<input name="institution_name" maxLength={200}/></label>
      <label>External reference · optional<input name="external_id" maxLength={200}/></label><label>Existing player code · optional<input name="code" inputMode="numeric" pattern="[1-9][0-9]{3}" maxLength={4}/></label>
    </div><button className="ep-button" disabled={busy}>Add player</button></form></details>
  </div>;
}
