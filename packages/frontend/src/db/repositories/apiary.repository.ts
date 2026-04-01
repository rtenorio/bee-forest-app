import { BaseRepository } from './base.repository';
import type { Apiary } from '@bee-forest/shared';

export class ApiaryRepository extends BaseRepository<Apiary> {
  readonly storeName = 'apiaries' as const;
  readonly entityType = 'apiary' as const;
}

export const apiaryRepo = new ApiaryRepository();
