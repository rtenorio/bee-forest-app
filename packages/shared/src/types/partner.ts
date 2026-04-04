// ── Enums / Unions ────────────────────────────────────────────────────────────

export type PartnerStatus = 'active' | 'inactive' | 'suspended';
export type LoanStatus = 'active' | 'returned' | 'lost';
export type LoanItemType = 'bombona' | 'caixa' | 'equipamento' | 'outro';
export type ManagementType = 'rational' | 'semi_rational';
export type DeliveryQualityStatus = 'pending' | 'approved' | 'approved_with_observation' | 'rejected';
export type QualityTestResult = 'approved' | 'approved_with_observation' | 'rejected';
export type PartnerVisualAspect = 'limpido' | 'levemente_turvo' | 'turvo';
export type PaymentStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';
export type HoneyTypePartner = 'vivo' | 'maturado';

// ── Core entities ─────────────────────────────────────────────────────────────

export interface Partner {
  id: number;
  local_id: string;
  full_name: string;
  document: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  bank_name: string | null;
  bank_agency: string | null;
  bank_account: string | null;
  pix_key: string | null;
  partnership_start_date: string | null;
  status: PartnerStatus;
  max_purchase_pct: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type PartnerCreate = Omit<Partner, 'id' | 'local_id' | 'created_at' | 'updated_at'>;
export type PartnerUpdate = Partial<PartnerCreate>;

export interface PartnerApiary {
  id: number;
  local_id: string;
  partner_id: number;
  name: string;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  bee_species: string | null;
  active_hives_count: number;
  management_type: ManagementType | null;
  technical_responsible: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type PartnerApiaryCreate = Omit<PartnerApiary, 'id' | 'local_id' | 'partner_id' | 'created_at' | 'updated_at'>;
export type PartnerApiaryUpdate = Partial<PartnerApiaryCreate>;

export interface PartnerEquipmentLoan {
  id: number;
  local_id: string;
  partner_id: number;
  item_name: string;
  item_type: LoanItemType;
  quantity: number;
  unit: string;
  delivery_date: string;
  expected_return_date: string | null;
  actual_return_date: string | null;
  delivery_condition: string | null;
  return_condition: string | null;
  contract_url: string | null;
  status: LoanStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type EquipmentLoanCreate = Omit<PartnerEquipmentLoan, 'id' | 'local_id' | 'partner_id' | 'created_at' | 'updated_at'>;

export interface PartnerDelivery {
  id: number;
  local_id: string;
  partner_id: number;
  partner_apiary_id: number | null;
  delivery_date: string;
  honey_type: HoneyTypePartner;
  bee_species: string | null;
  volume_ml: number | null;
  weight_kg: number | null;
  purchase_pct: number;
  accepted_volume_ml: number | null;
  accepted_weight_kg: number | null;
  price_per_kg: number | null;
  total_value: number | null;
  quality_status: DeliveryQualityStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // joined fields
  partner_apiary_name?: string | null;
}

export type DeliveryCreate = Omit<PartnerDelivery, 'id' | 'local_id' | 'partner_id' | 'created_at' | 'updated_at' | 'partner_apiary_name' | 'quality_status'>;

export interface PartnerQualityTest {
  id: number;
  delivery_id: number;
  tested_at: string;
  tested_by: number | null;
  tested_by_name?: string | null;
  hmf: number | null;
  hmf_approved: boolean | null;
  moisture_pct: number | null;
  moisture_approved: boolean | null;
  brix: number | null;
  visual_aspect: PartnerVisualAspect | null;
  aroma: string | null;
  overall_result: QualityTestResult;
  observations: string | null;
  created_at: string;
}

export type QualityTestCreate = {
  tested_at?: string;
  hmf?: number | null;
  moisture_pct?: number | null;
  brix?: number | null;
  visual_aspect?: PartnerVisualAspect | null;
  aroma?: string | null;
  observations?: string | null;
};

export interface PartnerPayment {
  id: number;
  local_id: string;
  delivery_id: number;
  partner_id: number;
  installment: 1 | 2;
  amount: number;
  due_date: string | null;
  paid_date: string | null;
  status: PaymentStatus;
  payment_method: string | null;
  receipt_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // joined
  partner_name?: string;
  delivery_date?: string;
}

// ── API responses ─────────────────────────────────────────────────────────────

export interface PartnerSummary extends Partner {
  total_hives: number;
  total_volume_ml: number | null;
  total_weight_kg: number | null;
  approval_rate: number | null;
  active_loans_count: number;
  pending_payments_count: number;
  overdue_payments_count: number;
  pending_delivery_count: number;
}

export interface PartnerDetail extends Partner {
  apiaries: PartnerApiary[];
  loans: PartnerEquipmentLoan[];
  deliveries: (PartnerDelivery & { quality_test?: PartnerQualityTest | null; payments?: PartnerPayment[] })[];
  payments: PartnerPayment[];
}

export interface PartnerQualitySummary {
  partner_id: number;
  partner_local_id: string;
  partner_name: string;
  total_deliveries: number;
  approved: number;
  rejected: number;
  approval_rate: number | null;
  avg_hmf: number | null;
  avg_moisture: number | null;
  pending_test_count: number;
}

export interface PartnerFinanceSummary {
  partner_id: number;
  partner_local_id: string;
  partner_name: string;
  total_paid: number;
  total_pending: number;
  total_overdue: number;
  overdue_payments: PartnerPayment[];
}
