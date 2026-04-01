import { BaseRepository } from './base.repository';
import type { Species } from '@bee-forest/shared';

export class SpeciesRepository extends BaseRepository<Species> {
  readonly storeName = 'species' as const;
  readonly entityType = 'species' as const;
}

export const speciesRepo = new SpeciesRepository();
