import { cn } from '@/utils/cn';

export interface OptionCardItem {
  value: string;
  label: string;
  description?: string;
  icon?: string;
}

interface OptionCardsProps {
  options: OptionCardItem[];
  value: string | null;
  onChange: (value: string) => void;
  columns?: 2 | 3 | 4 | 5;
  color?: 'amber' | 'emerald' | 'red' | 'sky';
  compact?: boolean;
}

export function OptionCards({
  options,
  value,
  onChange,
  columns = 3,
  color = 'amber',
  compact = false,
}: OptionCardsProps) {
  const colClass = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 sm:grid-cols-3',
    4: 'grid-cols-2 sm:grid-cols-4',
    5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
  };

  const activeColors = {
    amber: 'bg-amber-500/15 border-amber-500/60 text-amber-200',
    emerald: 'bg-emerald-500/15 border-emerald-500/60 text-emerald-200',
    red: 'bg-red-500/15 border-red-500/60 text-red-200',
    sky: 'bg-sky-500/15 border-sky-500/60 text-sky-200',
  };

  const activeIconColors = {
    amber: 'text-amber-400',
    emerald: 'text-emerald-400',
    red: 'text-red-400',
    sky: 'text-sky-400',
  };

  return (
    <div className={cn('grid gap-2', colClass[columns])}>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'relative flex flex-col items-center justify-center gap-1 border rounded-xl transition-all duration-150 text-center',
              compact ? 'px-3 py-2.5' : 'px-4 py-3',
              active
                ? activeColors[color]
                : 'bg-stone-800/60 border-stone-700 text-stone-400 hover:border-stone-600 hover:text-stone-300 hover:bg-stone-800'
            )}
          >
            {opt.icon && (
              <span className={cn('text-xl leading-none', active ? activeIconColors[color] : 'text-stone-500')}>
                {opt.icon}
              </span>
            )}
            <span className="text-sm font-medium leading-tight">{opt.label}</span>
            {opt.description && !compact && (
              <span className={cn('text-xs leading-snug', active ? 'opacity-80' : 'text-stone-500')}>
                {opt.description}
              </span>
            )}
            {active && (
              <span className={cn('absolute top-1.5 right-1.5 w-2 h-2 rounded-full', {
                'bg-amber-400': color === 'amber',
                'bg-emerald-400': color === 'emerald',
                'bg-red-400': color === 'red',
                'bg-sky-400': color === 'sky',
              })} />
            )}
          </button>
        );
      })}
    </div>
  );
}
