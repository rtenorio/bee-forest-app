import type { UserRole } from '../shared';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        name: string;
        email: string;
        role: UserRole;
        apiary_local_ids: string[];
        hive_local_ids: string[];
      };
    }
  }
}
