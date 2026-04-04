import { z } from 'zod';

export const PartnerCreateSchema = z.object({
  full_name: z.string().min(2),
  document: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().max(2).optional().nullable(),
  phone: z.string().optional().nullable(),
  whatsapp: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
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
