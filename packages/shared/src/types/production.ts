import { SyncMeta } from './sync';

export type ProductType = 'honey' | 'propolis' | 'pollen' | 'wax';
export type QualityGrade = 'A' | 'B' | 'C';

export interface Production extends SyncMeta {
  hive_local_id: string;
  product_type: ProductType;
  quantity_g: number;
  harvested_at: string;
  quality_grade: QualityGrade | null;
  notes: string;
  created_at: string;
}

export type ProductionCreate = Omit<Production, keyof SyncMeta | 'created_at'>;
export type ProductionUpdate = Partial<ProductionCreate>;
