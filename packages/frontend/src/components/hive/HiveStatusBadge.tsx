import { Badge } from '@/components/ui/Badge';
import type { HiveStatus } from '@bee-forest/shared';

const STATUS_CONFIG: Record<HiveStatus, { label: string; variant: 'success' | 'warning' | 'danger' | 'default' }> = {
  active: { label: 'Ativa', variant: 'success' },
  inactive: { label: 'Inativa', variant: 'warning' },
  dead: { label: 'Morta', variant: 'danger' },
  transferred: { label: 'Transferida', variant: 'default' },
};

export function HiveStatusBadge({ status }: { status: HiveStatus }) {
  const config = STATUS_CONFIG[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
