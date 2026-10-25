import {
  DEFAULT_SETTINGS
} from '../src/lib/tournament/model.mjs';
export const actor = {
  email: 'admin@example.test',
  role: 'admin'
};
export const now = '2026-11-07T09:00:00.000Z';
export function snapshot(players = []) {
  return {
    revision: 0,
    settings: structuredClone(DEFAULT_SETTINGS),
    players,
    rounds: [],
    games: []
  };
}
export function player(id, extra = {}) {
  return {
    id,
    reg_number: id,
    code: String(1000 + id),
    full_name: `Player ${id}`,
    email: `p${id}@example.test`,
    phone: '0550000000',
    institution_type: 'ensia',
    institution_name: null,
    student_id: null,
    has_online_rating: false,
    online_rating: null,
    rating_platform: null,
    rating_time_control: null,
    level: 'intermediate',
    seed_rating: 2000 - id * 10,
    seed_source: 'admin',
    active: true,
    checked_in: true,
    consent: false,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    ...extra
  };
}
export function round(id, extra = {}) {
  return {
    id,
    number: id,
    stage: 'swiss',
    status: 'closed',
    duration_minutes: 30,
    planned_start: null,
    started_at: now,
    closed_at: now,
    warnings: [],
    context: null,
    invalidated: false,
    ...extra
  };
}
export function game(id, r, white, black, result, extra = {}) {
  return {
    id,
    round_id: r,
    white_id: white,
    black_id: black,
    table_number: black ? id : null,
    kind: 'swiss',
    result,
    is_forfeit: false,
    updated_at: now,
    finished_at: result ? now : null,
    entered_by: actor.email,
    ...extra
  };
}
export function playerInput(extra = {}) {
  return {
    full_name: 'New Player',
    seed_rating: 800,
    ...extra
  };
}
