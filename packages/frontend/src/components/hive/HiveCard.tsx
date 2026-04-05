import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { HiveStatusBadge } from './HiveStatusBadge';
import { daysSince, formatDate } from '@/utils/dates';
import { cn } from '@/utils/cn';
import type { Hive } from '@bee-forest/shared';

interface HiveCardProps {
  hive: Hive;
  lastInspectedAt?: string | null;
  speciesName?: string;
}

function getHealthColor(daysSinceInspection: number | null): string {
  if (daysSinceInspection === null) return 'border-stone-700';
  if (daysSinceInspection <= 14) return 'border-emerald-600';
  if (daysSinceInspection <= 30) return 'border-amber-600';
  return 'border-red-600';
}

export function HiveCard({ hive, lastInspectedAt, speciesName }: HiveCardProps) {
  const navigate = useNavigate();
  const days = daysSince(lastInspectedAt);

  return (
    <Card
      hover
      onClick={() => navigate(`/hives/${hive.local_id}`)}
      className={cn('border-l-4', getHealthColor(days))}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="font-bold text-stone-100 text-lg">{hive.code}</h3>
          {speciesName && <p className="text-xs text-stone-500">{speciesName}</p>}
        </div>
        <HiveStatusBadge status={hive.status} />
      </div>

      {hive.apiary_origin_local_id && hive.apiary_origin_local_id !== hive.apiary_local_id && (
        <span className="inline-block text-xs bg-sky-900/40 text-sky-300 border border-sky-700/40 px-2 py-0.5 rounded-full mb-2">
          Transferida
        </span>
      )}

      {hive.box_type && (
        <p className="text-xs text-stone-500 mb-2">Caixa: {hive.box_type}</p>
      )}

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-stone-800">
        <div className="text-xs text-stone-500">
          {lastInspectedAt ? (
            <>
              <span className="text-stone-400">Última inspeção:</span>{' '}
              {days !== null && days > 0 ? `há ${days} dia${days > 1 ? 's' : ''}` : formatDate(lastInspectedAt)}
            </>
          ) : (
            <span className="text-red-400">Nunca inspecionada</span>
          )}
        </div>
        {hive.installation_date && (
          <div className="text-xs text-stone-600">
            Desde {formatDate(hive.installation_date)}
          </div>
        )}
      </div>
    </Card>
  );
}
