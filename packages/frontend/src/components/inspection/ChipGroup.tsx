import { cn } from '@/utils/cn';

export interface ChipOption {
  value: string;
  label: string;
}

interface ChipGroupProps {
  options: ChipOption[];
  value: string[];
  onChange: (value: string[]) => void;
  className?: string;
  color?: 'amber' | 'sky' | 'emerald' | 'red';
}

export function ChipGroup({
  options,
  value,
  onChange,
  className,
  color = 'amber',
}: ChipGroupProps) {
  const toggle = (v: string) => {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  };

  const activeColors = {
    amber: 'bg-amber-500/20 border-amber-500/50 text-amber-300',
    sky: 'bg-sky-500/20 border-sky-500/50 text-sky-300',
    emerald: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300',
    red: 'bg-red-500/20 border-red-500/50 text-red-300',
  };

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {options.map((opt) => {
        const active = value.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggle(opt.value)}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium border transition-all duration-150',
              active
                ? activeColors[color]
                : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-stone-600 hover:text-stone-300'
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
