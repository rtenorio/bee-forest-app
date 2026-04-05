/**
 * Shared types and schemas — inlined from @bee-forest/shared to avoid
 * Docker multi-stage symlink resolution issues with npm workspaces.
 */

import { z } from 'zod';

// ── Types: Auth ───────────────────────────────────────────────────────────────

export type UserRole = 'master_admin' | 'socio' | 'orientador' | 'responsavel' | 'tratador';

// ── Types: Sync ───────────────────────────────────────────────────────────────

export type EntityType =
  | 'apiary'
  | 'hive'
  | 'species'
  | 'inspection'
  | 'production'
  | 'feeding'
  | 'harvest'
  | 'batch'
  | 'stock_item';

export interface SyncQueueItem {
  id: string;
  entity_type: EntityType;
  entity_local_id: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: Record<string, unknown>;
  created_at: string;
  attempts: number;
  last_error: string | null;
}

// ── Schemas: Auth ─────────────────────────────────────────────────────────────

export const LoginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Senha obrigatória'),
});

export const RoleEnum = z.enum(['master_admin', 'socio', 'orientador', 'responsavel', 'tratador']);

export const CreateUserSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório').max(150),
  email: z.string().email('E-mail inválido'),
  phone: z.string().max(30).optional(),
  role: RoleEnum,
  apiary_local_ids: z.array(z.string().uuid()).default([]),
  hive_local_ids: z.array(z.string().uuid()).default([]),
  observations: z.string().max(1000).optional(),
});

export const UpdateUserSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(30).optional(),
  observations: z.string().max(1000).optional(),
  apiary_local_ids: z.array(z.string().uuid()).optional(),
  hive_local_ids: z.array(z.string().uuid()).optional(),
});

export const ChangeRoleSchema = z.object({
  role: RoleEnum,
});

// ── Schemas: Apiary ───────────────────────────────────────────────────────────

export const ApiaryCreateSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(150),
  location: z.string().max(255).default(''),
  latitude: z.number().min(-90).max(90).nullable().default(null),
  longitude: z.number().min(-180).max(180).nullable().default(null),
  owner_name: z.string().max(150).default(''),
  notes: z.string().default(''),
});

export const ApiaryUpdateSchema = ApiaryCreateSchema.partial();

// ── Schemas: Species ──────────────────────────────────────────────────────────

export const SpeciesCreateSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100),
  scientific_name: z.string().max(150).default(''),
  description: z.string().default(''),
});

export const SpeciesUpdateSchema = SpeciesCreateSchema.partial();

// ── Schemas: Hive ─────────────────────────────────────────────────────────────

export const HiveStatusSchema = z.enum(['active', 'inactive', 'dead', 'transferred']);

export const HiveCreateSchema = z.object({
  apiary_local_id: z.string().uuid('ID do apiário inválido'),
  species_local_id: z.string().uuid().nullable().default(null),
  code: z.string().min(1, 'Código é obrigatório').max(50),
  status: HiveStatusSchema.default('active'),
  installation_date: z.string().nullable().default(null),
  box_type: z.string().max(50).default(''),
  modules_count: z.number().int().min(1).nullable().default(null),
  wood_type: z.string().max(50).nullable().default(null),
  wood_type_other: z.string().max(100).nullable().default(null),
  notes: z.string().default(''),
  has_honey_super: z.boolean().default(false),
  honey_super_placed_at: z.string().nullable().default(null),
  honey_super_removed_at: z.string().nullable().default(null),
});

export const HiveUpdateSchema = HiveCreateSchema.partial().omit({ apiary_local_id: true });

// ── Schemas: Inspection ───────────────────────────────────────────────────────

export const InspectionTaskSchema = z.object({
  id: z.string(),
  label: z.string(),
  custom_text: z.string().default(''),
  due_date: z.string().nullable().default(null),
  assignee_name: z.string().default(''),
  priority: z.enum(['normal', 'urgent']).default('normal'),
});

export const InspectionChecklistSchema = z.object({
  inspection_type: z.enum(['external_only', 'external_internal']).nullable().default(null),
  time_of_day: z.enum(['morning', 'afternoon', 'night']).nullable().default(null),
  precipitation_observed: z.boolean().default(false),
  weather_feel: z.array(z.string()).default([]),
  perceived_bloom: z.enum(['low', 'medium', 'high']).nullable().default(null),
  weather_notes: z.string().default(''),
  activity_level: z.enum(['very_low', 'low', 'normal', 'high']).nullable().default(null),
  activity_observations: z.array(z.string()).default([]),
  entry_notes: z.string().default(''),
  colony_strength: z.enum(['very_weak', 'weak', 'medium', 'strong', 'very_strong']).nullable().default(null),
  strength_observations: z.array(z.string()).default([]),
  honey_stores: z.enum(['low', 'adequate', 'high']).nullable().default(null),
  pollen_stores: z.enum(['low', 'adequate', 'high']).nullable().default(null),
  food_observations: z.array(z.string()).default([]),
  food_notes: z.string().default(''),
  brood_status: z.enum(['not_evaluated', 'reduced', 'normal', 'intense']).nullable().default(null),
  brood_observations: z.array(z.string()).default([]),
  brood_notes: z.string().default(''),
  box_observations: z.array(z.string()).default([]),
  box_notes: z.string().default(''),
  invaders: z.array(z.string()).default([]),
  other_invader_text: z.string().default(''),
  weakness_signs: z.array(z.string()).default([]),
  internal_changes: z.array(z.string()).default([]),
  odor_description: z.string().default(''),
  sanitary_severity: z.enum(['mild', 'moderate', 'severe', 'critical']).nullable().default(null),
  productive_potential: z.enum(['very_low', 'low', 'medium', 'high', 'very_high']).nullable().default(null),
  productive_observations: z.array(z.string()).default([]),
  productive_notes: z.string().default(''),
  management_actions: z.array(z.string()).default([]),
  management_description: z.string().default(''),
  materials_used: z.string().default(''),
  tasks: z.array(InspectionTaskSchema).default([]),
  overall_status: z.enum(['healthy', 'attention', 'high_risk', 'critical']).nullable().default(null),
  recommendation: z.enum(['maintain_routine', 'reassess_soon', 'corrective_management', 'refer_to_technician']).nullable().default(null),
  next_inspection_days: z.number().nullable().default(null),
  final_summary: z.string().default(''),
  generate_alert: z.boolean().default(false),
  notify_technician: z.boolean().default(false),
  mark_priority: z.boolean().default(false),
});

export const InspectionCreateSchema = z.object({
  hive_local_id: z.string().uuid('ID da caixa inválido'),
  inspected_at: z.string(),
  inspector_name: z.string().max(150).default(''),
  checklist: InspectionChecklistSchema.default({}),
  weight_kg: z.number().positive().nullable().default(null),
  temperature_c: z.number().nullable().default(null),
  humidity_pct: z.number().min(0).max(100).nullable().default(null),
  precipitation_mm: z.number().min(0).nullable().default(null),
  sky_condition: z.enum(['sunny', 'partly_cloudy', 'cloudy']).nullable().default(null),
  notes: z.string().default(''),
  photos: z.array(z.string()).default([]),
  audio_notes: z.array(z.string()).default([]),
  next_inspection_due: z.string().nullable().default(null),
});

export const InspectionUpdateSchema = InspectionCreateSchema.partial().omit({ hive_local_id: true });

// ── Schemas: Production ───────────────────────────────────────────────────────

export const ProductionCreateSchema = z.object({
  hive_local_id: z.string().uuid('ID da colmeia inválido'),
  product_type: z.enum(['honey', 'propolis', 'pollen', 'wax']),
  quantity_g: z.number().positive('Quantidade deve ser positiva'),
  harvested_at: z.string(),
  quality_grade: z.enum(['A', 'B', 'C']).nullable().default(null),
  notes: z.string().default(''),
});

export const ProductionUpdateSchema = ProductionCreateSchema.partial().omit({ hive_local_id: true });

// ── Schemas: Feeding ──────────────────────────────────────────────────────────

export const FeedingCreateSchema = z.object({
  hive_local_id: z.string().uuid('ID da colmeia inválido'),
  feed_type: z.enum(['sugar_syrup', 'honey', 'pollen_sub', 'other']),
  quantity_ml: z.number().positive().nullable().default(null),
  fed_at: z.string(),
  notes: z.string().default(''),
});

export const FeedingUpdateSchema = FeedingCreateSchema.partial().omit({ hive_local_id: true });

// ── Schemas: Harvest ──────────────────────────────────────────────────────────

export const HarvestCreateSchema = z.object({
  apiary_local_id: z.string().uuid('ID do meliponário inválido'),
  harvested_at: z.string().min(1, 'Data obrigatória'),
  responsible_name: z.string().default(''),
  hive_local_ids: z.array(z.string().uuid()).min(1, 'Selecione ao menos uma caixa'),
  hive_volumes: z.record(z.number().nonnegative()).default({}),
  honey_type: z.enum(['vivo', 'maturado']),
  maturation_status: z.enum(['aguardando_maturacao', 'em_maturacao', 'concluido']).nullable().default(null),
  total_volume_ml: z.number().positive().nullable().default(null),
  total_weight_kg: z.number().positive().nullable().default(null),
  humidity_pct: z.number().min(0).max(100).nullable().default(null),
  brix: z.number().min(0).max(100).nullable().default(null),
  visual_aspect: z.enum(['clear', 'cloudy', 'crystallized']).nullable().default(null),
  bubbles: z.enum(['none', 'few', 'many']).nullable().default(null),
  paper_test: z.enum(['pass', 'fail']).nullable().default(null),
  viscosity: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).nullable().default(null),
  syrup_provided: z.boolean().default(false),
  pollen_ball_provided: z.boolean().default(false),
  wax_provided: z.boolean().default(false),
  input_notes: z.string().default(''),
  notes: z.string().default(''),
});

export const HarvestUpdateSchema = HarvestCreateSchema.partial().omit({ apiary_local_id: true });

// ── Schemas: Sync ─────────────────────────────────────────────────────────────

export const SyncQueueItemSchema = z.object({
  id: z.string().uuid(),
  entity_type: z.enum(['apiary', 'hive', 'species', 'inspection', 'production', 'feeding', 'harvest', 'batch', 'stock_item']),
  entity_local_id: z.string().uuid(),
  operation: z.enum(['CREATE', 'UPDATE', 'DELETE']),
  payload: z.record(z.unknown()),
  created_at: z.string(),
  attempts: z.number().int().min(0).default(0),
  last_error: z.string().nullable().default(null),
});

export const SyncPayloadSchema = z.object({
  client_id: z.string().uuid(),
  items: z.array(SyncQueueItemSchema),
  last_sync_at: z.string().nullable(),
});

// ── Schemas: Partners ─────────────────────────────────────────────────────────

export const PartnerCreateSchema = z.object({
  full_name: z.string().min(2),
  document: z.string().min(1),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().max(2).optional().nullable(),
  phone: z.string().optional().nullable(),
  whatsapp: z.string().min(1),
  email: z.string().optional().nullable(),
  bank_name: z.string().optional().nullable(),
  bank_agency: z.string().optional().nullable(),
  bank_account: z.string().optional().nullable(),
  pix_key: z.string().optional().nullable(),
  partnership_start_date: z.string().optional().nullable(),
  status: z.enum(['active', 'inactive', 'suspended']).default('active'),
  max_purchase_pct: z.number().min(0).max(100).default(70),
  notes: z.string().optional().nullable(),
});

export const PartnerUpdateSchema = PartnerCreateSchema.partial();

export const PartnerApiaryCreateSchema = z.object({
  name: z.string().min(2),
  city: z.string().optional().nullable(),
  state: z.string().max(2).optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  bee_species: z.string().optional().nullable(),
  active_hives_count: z.number().int().min(0).default(0),
  management_type: z.enum(['rational', 'semi_rational']).optional().nullable(),
  technical_responsible: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const EquipmentLoanCreateSchema = z.object({
  item_name: z.string().min(2),
  item_type: z.enum(['bombona', 'caixa', 'equipamento', 'outro']),
  quantity: z.number().int().min(1).default(1),
  unit: z.string().default('unidade'),
  delivery_date: z.string(),
  expected_return_date: z.string().optional().nullable(),
  delivery_condition: z.string().optional().nullable(),
  contract_url: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const DeliveryCreateSchema = z.object({
  partner_apiary_id: z.number().int().optional().nullable(),
  delivery_date: z.string(),
  honey_type: z.enum(['vivo', 'maturado']),
  bee_species: z.string().optional().nullable(),
  volume_ml: z.number().min(0).optional().nullable(),
  weight_kg: z.number().min(0).optional().nullable(),
  purchase_pct: z.number().min(0).max(100).default(70),
  price_per_kg: z.number().min(0).optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const QualityTestCreateSchema = z.object({
  tested_at: z.string().optional(),
  hmf: z.number().min(0).optional().nullable(),
  moisture_pct: z.number().min(0).max(100).optional().nullable(),
  brix: z.number().min(0).optional().nullable(),
  visual_aspect: z.enum(['limpido', 'levemente_turvo', 'turvo']).optional().nullable(),
  aroma: z.string().optional().nullable(),
  observations: z.string().optional().nullable(),
});

export const PayPaymentSchema = z.object({
  paid_date: z.string().optional(),
  payment_method: z.string().optional().nullable(),
  receipt_url: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// ── Schemas: Instructions ─────────────────────────────────────────────────────

export const InstructionCreateSchema = z.object({
  local_id: z.string().uuid(),
  apiary_local_id: z.string().uuid(),
  hive_local_id: z.string().uuid().optional().nullable(),
  text_content: z.string().optional().nullable(),
  audio_url: z.string().optional().nullable(),
});

export const InstructionStatusSchema = z.object({
  status: z.enum(['pending', 'done']),
});

export const InstructionResponseCreateSchema = z.object({
  local_id: z.string().uuid(),
  text_content: z.string().optional().nullable(),
  audio_url: z.string().optional().nullable(),
});

// ── Schemas: Divisions ────────────────────────────────────────────────────────

export const DivisionCreateSchema = z.object({
  local_id: z.string().uuid(),
  hive_origin_local_id: z.string().uuid(),
  apiary_origin_local_id: z.string().uuid(),
  identified_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  identified_by: z.string().min(1).max(150),
  notes: z.string().optional().nullable(),
});

export const DivisionUpdateSchema = z.object({
  status: z.enum(['pendente', 'realizada', 'cancelada']).optional(),
  hive_new_local_id: z.string().uuid().optional().nullable(),
  apiary_destination_local_id: z.string().uuid().optional().nullable(),
  divided_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  divided_by: z.string().max(150).optional().nullable(),
  notes: z.string().optional().nullable(),
});

// ── Schemas: Transfers ────────────────────────────────────────────────────────

export const HiveTransferCreateSchema = z.object({
  local_id: z.string().uuid(),
  hive_local_id: z.string().uuid(),
  apiary_origin_local_id: z.string().uuid(),
  apiary_destination_local_id: z.string().uuid(),
  transferred_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  transferred_by: z.string().min(1).max(150),
  reason: z.string().optional().nullable(),
});

// ── Schemas: Equipment ────────────────────────────────────────────────────────

const EquipmentItemTypeEnum = z.enum(['modulo_ninho', 'modulo_sobreninho', 'caixa_vazia']);
const EquipmentMovementTypeEnum = z.enum(['entrada', 'saida', 'instalacao', 'retirada', 'desmontagem']);

export const EquipmentAdjustSchema = z.object({
  type: EquipmentItemTypeEnum,
  delta: z.number().int().refine((n) => n !== 0, { message: 'Delta não pode ser zero' }),
  movement_type: EquipmentMovementTypeEnum,
  reason: z.string().optional().nullable(),
  performed_by: z.string().max(150).optional().nullable(),
  hive_local_id: z.string().uuid().optional().nullable(),
});

export const MelgueiraCreateSchema = z.object({
  local_id: z.string().uuid(),
  code: z.string().min(1).max(50),
  apiary_local_id: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const MelgueiraUpdateSchema = z.object({
  code: z.string().min(1).max(50).optional(),
  status: z.enum(['disponivel', 'em_uso', 'manutencao']).optional(),
  notes: z.string().optional().nullable(),
  apiary_local_id: z.string().uuid().optional().nullable(),
});

export const MelgueiraInstallSchema = z.object({
  hive_local_id: z.string().uuid(),
  installed_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  performed_by: z.string().max(150).optional().nullable(),
});

export const MelgueiraRemoveSchema = z.object({
  performed_by: z.string().max(150).optional().nullable(),
  reason: z.string().optional().nullable(),
});
