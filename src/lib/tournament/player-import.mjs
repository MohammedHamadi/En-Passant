import {
  requireRule,
  seedRating,
  settingsOf,
  uniqueCode,
  nextId
} from './model.mjs';

const optionalText = value => typeof value === 'string' && value.trim() ? value.trim() : null;
export function normalizePlayer(input, settings) {
  requireRule(typeof input.full_name === 'string' && input.full_name.trim(), 'Player name is required.');
  requireRule(input.full_name.trim().length <= 200, 'Player name is too long.');
  requireRule(input.online_rating == null || Number.isInteger(input.online_rating) && input.online_rating >=
    100 && input.online_rating <= 3500, 'Online rating must be from 100 to 3500.');
  requireRule(!input.level || ['beginner', 'casual', 'intermediate', 'advanced', 'experienced'].includes(input
    .level), 'Invalid level.');
  requireRule(!input.rating_platform || ['chess_com', 'lichess', 'other'].includes(input.rating_platform),
    'Invalid rating platform.');
  requireRule(!input.rating_time_control || ['rapid', 'blitz', 'classical'].includes(input
    .rating_time_control), 'Invalid rating time control.');
  const email = optionalText(input.email)?.toLowerCase() ?? null;
  requireRule(!email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 'Invalid email.');
  const code = optionalText(input.code);
  requireRule(!code || /^[1-9]\d{3}$/.test(code), 'Player code must contain four digits from 1000 to 9999.');
  const source = input.seed_rating != null ? {
    seed_rating: input.seed_rating,
    seed_source: 'admin'
  } : input.online_rating != null ? seedRating({
    ...input,
    has_online_rating: true
  }, settings) : input.level ? seedRating({
    ...input,
    has_online_rating: false
  }, settings) : {
    seed_rating: 1200,
    seed_source: 'admin'
  };
  requireRule(Number.isInteger(source.seed_rating) && source.seed_rating >= 0 && source.seed_rating <= 3500,
    'Seed rating must be an integer from 0 to 3500.');
  requireRule(input.institution_type == null || ['ensia', 'other'].includes(input.institution_type),
    'School type must be ensia or other.');
  requireRule(input.active == null || typeof input.active === 'boolean', 'Active must be true or false.');
  requireRule(input.checked_in == null || typeof input.checked_in === 'boolean',
    'Checked-in must be true or false.');
  return {
    full_name: input.full_name.trim(),
    email,
    code,
    external_id: optionalText(input.external_id),
    phone: optionalText(input.phone),
    institution_type: input.institution_type ?? null,
    institution_name: optionalText(input.institution_name),
    student_id: optionalText(input.student_id),
    has_online_rating: input.online_rating != null ? true : input.level ? false : null,
    online_rating: input.online_rating ?? null,
    rating_platform: input.online_rating != null ? input.rating_platform ?? null : null,
    rating_time_control: input.online_rating != null ? input.rating_time_control ?? null : null,
    level: input.level ?? null,
    ...source,
    active: input.active ?? true,
    checked_in: input.checked_in ?? false,
    consent: input.consent ?? false
  };
}
export function appendPlayer(state, input, now, draw, reservedCodes = [], alreadyNormalized = false) {
  const normalized = alreadyNormalized ? input : normalizePlayer(input, settingsOf(state));
  requireRule(state.players.filter(p => !p.deleted_at).length < settingsOf(state).capacity,
    'Tournament player limit reached. Increase it in settings before adding players.', 409, 'CAPACITY_FULL');
  if (normalized.email) requireRule(!state.players.some(p => p.email === normalized.email),
    'Email already belongs to a player.', 409, 'DUPLICATE_EMAIL');
  if (normalized.external_id) requireRule(!state.players.some(p => p.external_id === normalized.external_id),
    'External reference already belongs to a player.', 409, 'DUPLICATE_EXTERNAL_ID');
  if (normalized.code) requireRule(!state.players.some(p => p.code === normalized.code),
    'Code already belongs to a player.', 409, 'DUPLICATE_CODE');
  const player = {
    ...normalized,
    id: nextId(state.players),
    reg_number: Math.max(0, ...state.players.map(p => p.reg_number ?? p.id)) + 1,
    code: normalized.code ?? uniqueCode([...state.players, ...reservedCodes.map(code => ({
      code
    }))], draw),
    created_at: now,
    updated_at: now,
    deleted_at: null
  };
  state.players.push(player);
  return player;
}

// CSV parser supports BOM, CRLF, escaped quotes, quoted commas and quoted line breaks.
export function parseCSV(text) {
  requireRule(typeof text === 'string' && text.length <= 750000, 'CSV must be smaller than 750 KB.');
  text = text.replace(/^\uFEFF/, '');
  const records = [];
  let row = [],
    field = '',
    quoted = false,
    afterQuote = false;
  const finishField = () => {
    row.push(field);
    field = '';
    afterQuote = false;
  };
  const finishRow = () => {
    finishField();
    if (row.some(value => value.trim())) records.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
          afterQuote = true;
        }
      } else field += c;
      continue;
    }
    if (c === '"') {
      requireRule(!field && !afterQuote, 'Unexpected quote in CSV.');
      quoted = true;
    } else if (c === ',') finishField();
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      finishRow();
    } else {
      requireRule(!afterQuote || /[ \t]/.test(c), 'Unexpected text after a quoted CSV field.');
      if (!afterQuote) field += c;
    }
  }
  requireRule(!quoted, 'Unclosed quoted field in CSV.');
  if (field || row.length || afterQuote) finishRow();
  requireRule(records.length >= 2, 'CSV needs a header and at least one player row.');
  requireRule(records.length <= 5001, 'Upload at most 5,000 players at once.');
  return records;
}
const aliases = {
  fullname: 'full_name',
  seedrating: 'seed_rating',
  player_code: 'code',
  email_address: 'email',
  school_name: 'institution_name',
  university_name: 'institution_name',
  name: 'full_name',
  player_name: 'full_name',
  player: 'full_name',
  elo: 'seed_rating',
  rating: 'seed_rating',
  id: 'external_id',
  registration_id: 'external_id',
  participant_id: 'external_id',
  school: 'institution_name',
  university: 'institution_name',
  platform: 'rating_platform',
  time_control: 'rating_time_control',
  present: 'checked_in',
  is_present: 'checked_in',
  is_active: 'active'
};
const columns = new Set(['full_name', 'seed_rating', 'external_id', 'email', 'phone', 'institution_type',
  'institution_name', 'student_id', 'online_rating', 'rating_platform', 'rating_time_control', 'level',
  'code', 'checked_in', 'active', 'consent'
]);

function booleanField(value, label) {
  if (value == null || value.trim() === '') return undefined;
  const text = value.trim().toLowerCase();
  if (['true', 'yes', '1', 'present'].includes(text)) return true;
  if (['false', 'no', '0', 'absent'].includes(text)) return false;
  throw new Error(`${label} must be true/false, yes/no, or 1/0.`);
}

function numberField(value, label) {
  if (value == null || value.trim() === '') return undefined;
  requireRule(/^\d+$/.test(value.trim()), `${label} must be a whole number.`);
  return Number(value);
}

function identityMatches(players, player) {
  const matches = players.filter(p => (player.external_id && p.external_id === player.external_id) || (player
    .email && p.email?.toLowerCase() === player.email) || (player.code && p.code === player.code));
  requireRule(new Set(matches.map(p => p.id)).size <= 1,
    'The supplied identifiers belong to different players.');
  if (matches.length) {
    const existing = matches[0];
    requireRule(!(player.external_id && existing.external_id && player.external_id !== existing.external_id),
      'External reference conflicts with an existing player.');
    requireRule(!(player.email && existing.email && player.email !== existing.email.toLowerCase()),
      'Email conflicts with an existing player.');
    requireRule(!(player.code && existing.code && player.code !== existing.code),
      'Code conflicts with an existing player.');
    return existing;
  }
  if (!player.external_id && !player.email && !player.code) return players.find(p => p.full_name.trim()
    .toLowerCase() === player.full_name.toLowerCase() && p.seed_rating === player.seed_rating);
  return null;
}
export function previewImport(snapshot, csv) {
  const records = parseCSV(csv),
    headers = records[0].map(h => {
      const name = h.trim().toLowerCase().replace(/[\s-]+/g, '_');
      return aliases[name] ?? name;
    });
  requireRule(headers.includes('full_name'), 'CSV must contain full_name or name.');
  requireRule(new Set(headers.filter(h => columns.has(h))).size === headers.filter(h => columns.has(h))
    .length, 'CSV has duplicate or equivalent columns.');
  const rows = [],
    prospective = [...snapshot.players],
    settings = settingsOf(snapshot);
  for (let i = 1; i < records.length; i++) {
    try {
      requireRule(records[i].length === headers.length, 'Column count does not match the header.');
      const raw = Object.fromEntries(headers.map((h, j) => [h, records[i][j]]));
      const value = Object.fromEntries(Object.entries(raw).filter(([key]) => columns.has(key)).map(([key,
        val]) => [key, optionalText(val)]));
      for (const key of ['seed_rating', 'online_rating']) value[key] = numberField(raw[key], key);
      for (const key of ['active', 'checked_in', 'consent']) value[key] = booleanField(raw[key], key);
      if (value.institution_type) value.institution_type = value.institution_type.toLowerCase();
      if (value.institution_name?.toLowerCase() === 'ensia') {
        value.institution_type = 'ensia';
        value.institution_name = null;
      } else if (value.institution_name && !value.institution_type) value.institution_type = 'other';
      if (value.rating_platform) value.rating_platform = {
        'chess.com': 'chess_com',
        'chesscom': 'chess_com'
      } [value.rating_platform.toLowerCase()] ?? value.rating_platform.toLowerCase();
      if (value.rating_time_control) value.rating_time_control = value.rating_time_control.toLowerCase();
      if (value.level) value.level = value.level.toLowerCase();
      const normalized = normalizePlayer(value, settings),
        duplicate = identityMatches(prospective, normalized);
      if (duplicate) rows.push({
        row: i + 1,
        status: 'skip',
        name: normalized.full_name,
        reason: 'Already in the roster or repeated in this file.'
      });
      else {
        rows.push({
          row: i + 1,
          status: 'add',
          name: normalized.full_name,
          player: normalized
        });
        prospective.push({
          ...normalized,
          id: -i
        });
      }
    } catch (error) {
      rows.push({
        row: i + 1,
        status: 'error',
        reason: error.message
      });
    }
  }
  const summary = {
    total: rows.length,
    added: rows.filter(r => r.status === 'add').length,
    skipped: rows.filter(r => r.status === 'skip').length,
    invalid: rows.filter(r => r.status === 'error').length
  };
  const exceedsCapacity = prospective.filter(p => !p.deleted_at).length > settings.capacity;
  return {
    summary,
    rows,
    unused_columns: headers.filter(h => !columns.has(h)),
    can_import: summary.invalid === 0 && !exceedsCapacity,
    error: exceedsCapacity ?
      `The upload exceeds the tournament player limit of ${settings.capacity}. Increase it in settings first.` :
      null
  };
}
