import { useState } from 'react';
import { cn } from '@/utils/cn';

interface InspectionSectionProps {
  step: number;
  title: string;
  subtitle?: string;
  icon: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string;
  badgeColor?: 'amber' | 'emerald' | 'red' | 'stone';
}

export function InspectionSection({
  step,
  title,
  subtitle,
  icon,
  children,
  defaultOpen = true,
  badge,
  badgeColor = 'stone',
}: InspectionSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  const badgeColors = {
    amber: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    emerald: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    red: 'bg-red-500/20 text-red-300 border-red-500/30',
    stone: 'bg-stone-700/60 text-stone-400 border-stone-600',
  };

  return (
    <section className="bg-stone-900 border border-stone-800 rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-4 px-6 py-5 text-left hover:bg-stone-800/50 transition-colors"
      >
        {/* Step badge */}
        <span className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-xs font-bold text-amber-400">
          {step}
        </span>

        {/* Icon */}
        <span className="text-2xl flex-shrink-0">{icon}</span>

        {/* Title */}
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-stone-100 leading-tight">{title}</h2>
          {subtitle && (
            <p className="text-xs text-stone-500 mt-0.5 truncate">{subtitle}</p>
          )}
        </div>

        {/* Optional badge */}
        {badge && (
          <span className={cn(
            'hidden sm:inline-flex flex-shrink-0 text-xs px-2.5 py-1 rounded-full border font-medium',
            badgeColors[badgeColor]
          )}>
            {badge}
          </span>
        )}

        {/* Chevron */}
        <svg
          className={cn('w-4 h-4 text-stone-500 flex-shrink-0 transition-transform duration-200', open && 'rotate-180')}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-6 pb-6 border-t border-stone-800/60">
          <div className="pt-5 space-y-5">
            {children}
          </div>
        </div>
      )}
    </section>
  );
}
