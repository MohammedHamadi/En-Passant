import {
  z
} from 'zod';
import {
  normalizePlayer
} from '../tournament/player-import.mjs';
import {
  DEFAULT_SETTINGS
} from '../tournament/model.mjs';
const text = z.string().trim().max(200);
const playerFields = {
  full_name: text.min(1),
  seed_rating: z.number().int().min(0).max(3500).optional(),
  external_id: text.nullable().optional(),
  email: z.union([z.string().trim().email().max(254), z.literal(''), z.null()]).optional(),
  phone: text.nullable().optional(),
  institution_type: z.enum(['ensia', 'other']).nullable().optional(),
  institution_name: text.nullable().optional(),
  student_id: text.nullable().optional(),
  online_rating: z.number().int().min(100).max(3500).nullable().optional(),
  rating_platform: z.enum(['chess_com', 'lichess', 'other']).nullable().optional(),
  rating_time_control: z.enum(['rapid', 'blitz', 'classical']).nullable().optional(),
  level: z.enum(['beginner', 'casual', 'intermediate', 'advanced', 'experienced']).nullable().optional(),
  code: z.string().regex(/^[1-9]\d{3}$/).nullable().optional(),
  active: z.boolean().optional(),
  checked_in: z.boolean().optional(),
  consent: z.boolean().optional(),
};
export const playerSchema = z.object(playerFields).strict().superRefine((value, ctx) => {
  try {
    normalizePlayer(value, DEFAULT_SETTINGS);
  } catch (error) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: error.message
    });
  }
});
export const playerPatchSchema = z.object(playerFields).omit({
  code: true
}).partial().strict();
export const importSchema = z.object({
  csv: z.string().min(1).max(750000)
}).strict();
export const resultSchema = z.object({
  result: z.enum(['white', 'black', 'draw', 'bye', 'double_forfeit']).nullable().optional(),
  is_forfeit: z.boolean().optional(),
  notes: z.string().max(5000).nullable().optional(),
  pgn: z.string().max(100000).nullable().optional(),
  moves_count: z.number().int().min(0).max(10000).nullable().optional(),
  acknowledge_later_rounds: z.boolean().optional()
}).strict();
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(200)
}).strict();
export const codeSchema = z.object({
  code: z.string().regex(/^[1-9]\d{3}$/)
}).strict();
export const swapSchema = z.object({
  player_a: z.number().int().positive(),
  player_b: z.number().int().positive()
}).strict();
export const publishSchema = z.object({
  planned_start: z.string().datetime({
    offset: true
  }).nullable().optional()
}).strict();
export const armageddonSchema = z.object({
  white_id: z.number().int().positive(),
  black_id: z.number().int().positive(),
  result: z.enum(['white', 'black', 'draw'])
}).strict();
export const settingsSchema = z.object({
  capacity: z.number().int().min(2).max(9000),
  swiss_rounds_planned: z.number().int().min(1).max(20).nullable(),
  show_rounds_publicly: z.boolean(),
  round_minutes: z.number().int().min(1).max(180),
  late_forfeit_minutes: z.number().int().min(0).max(60),
  lichess_offset: z.number().int().min(0).max(1000),
  round1_method: z.enum(['closest', 'top_half']),
  schedule: z.array(z.object({
    time: text,
    activity: text
  })).max(30),
  level_defaults: z.object({
    beginner: z.number().int(),
    casual: z.number().int(),
    intermediate: z.number().int(),
    advanced: z.number().int(),
    experienced: z.number().int()
  }),
  pairing_weights: z.object({
    rating: z.number().finite().min(0).max(100000),
    score_gap: z.number().finite().min(0).max(100000),
    both_must: z.number().finite().min(0).max(100000),
    must_prefer: z.number().finite().min(0).max(100000),
    both_prefer: z.number().finite().min(0).max(100000),
    rematch: z.number().finite().min(0).max(100000)
  })
}).partial().strict();
