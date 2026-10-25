export type Colour = 'white' | 'black';
export type GameResult = 'white' | 'black' | 'draw' | 'bye' | 'double_forfeit' | null;
export interface PublicPlayer {
  id: number;reg_number: number;full_name: string;
  institution_type: 'ensia' | 'other' | null;institution_name: string | null;
  level: string | null;seed_rating: number;active: boolean;checked_in: boolean;
}
export interface Player extends PublicPlayer {
  external_id ? : string | null;
  code: string;
  email: string | null;
  phone: string | null;
  student_id: string | null;
  has_online_rating: boolean | null;
  online_rating: number | null;
  rating_platform: string | null;
  rating_time_control: string | null;
  seed_source: 'online' | 'level' | 'admin';
  consent: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
export type AdminPlayer = PublicPlayer & Partial < Omit < Player, keyof PublicPlayer >> ;
export interface HistoryEntry {
  round: number;opponent: Pick < PublicPlayer,
  'id' | 'full_name' | 'seed_rating' > | null;
  colour: Colour | null;result: string;points: number;score: number;is_forfeit ? : boolean;
}
export interface Standing extends PublicPlayer {
  score: number;buchholz: number;byes: number;wins: number;draws: number;
  losses: number;games: number;opponents: number[];colour_history: Colour[];
  history: HistoryEntry[];direct_encounter: number;rank: number;tie: boolean;
  rank_change: number;status: string;
}
export interface TimerRound {
  id: number;number: number;status: 'draft' | 'published' | 'running' | 'closed';
  duration_minutes: number;started_at: string | null;planned_start: string | null;
}
export interface Round extends TimerRound {
  stage: 'swiss' | 'knockout';closed_at: string | null;
  warnings: string[];context: string | null;invalidated: boolean;
}
export interface Game {
  id: number;round_id: number;white_id: number;black_id: number | null;
  table_number: number | null;kind: 'swiss' | 'knockout' | 'armageddon';
  result: GameResult;is_forfeit: boolean;notes ? : string | null;pgn ? : string | null;
  moves_count ? : number | null;finished_at: string | null;entered_by: string;
  updated_at: string;tie_context ? : string | null;
}
export interface PublishedGame {
  id: number;round: number;round_status: TimerRound['status'];table_number: number | null;
  white: PublicPlayer;black: PublicPlayer | null;result: GameResult;is_forfeit: boolean;
}
export type PublicRound = TimerRound & {
  games: Omit < PublishedGame,
  'round' | 'round_status' > []
};
export interface Settings {
  tournament_state: string;capacity: number;
  swiss_rounds_planned: number | null;
  show_rounds_publicly: boolean;knockout_size: number | null;
  show_knockout_size_publicly: boolean;ratings_locked: boolean;
  round_minutes: number;late_forfeit_minutes: number;lichess_offset: number;
  round1_method: 'closest' | 'top_half';level_defaults: Record < string,
  number > ;
  pairing_weights: Record < string,
  number > ;schedule: {
    time: string;activity: string
  } [];
}
export interface PublicSettings {
  tournament_state: string;capacity: number;player_count: number;
  swiss_rounds_planned: number | null;
  knockout_size: number | null;round_minutes: number;schedule: Settings['schedule'];
}
export interface PublicResponse < T > {
  data: T;server_time: string
}
export interface MeView {
  player: Standing;round: TimerRound | null;server_time: string;
  match: {
    id: number;table_number: number | null;colour: Colour | null;
    opponent: PublicPlayer | null;result: GameResult;is_forfeit: boolean
  } | null;
}
export interface AdminState {
  revision: number;players: AdminPlayer[];rounds: Round[];games: Game[];
  settings: Settings;standings: Standing[];role: 'admin' | 'arbiter';server_time: string;
}
export interface AuditEntry {
  id: number;actor: string;action: string;created_at: string;
  old_value: unknown;new_value: unknown;
}

export interface ImportSummary {
  total: number;added: number;skipped: number;invalid: number
}
export interface ImportPreview {
  summary: ImportSummary;can_import: boolean;error: string | null;unused_columns: string[];
  rows: {
    row: number;status: 'add' | 'skip' | 'error';name ? : string;reason ? : string;player ? : Partial <
      Player >
  } [];
}
