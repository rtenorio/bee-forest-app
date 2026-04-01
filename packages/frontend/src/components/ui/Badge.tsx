import { HTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'amber';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variants: Record<BadgeVariant, string> = {
  default: 'bg-stone-700 text-stone-200',
  success: 'bg-emerald-900/60 text-emerald-300 border border-emerald-800',
  warning: 'bg-amber-900/60 text-amber-300 border border-amber-800',
  danger: 'bg-red-900/60 text-red-300 border border-red-800',
  info: 'bg-blue-900/60 text-blue-300 border border-blue-800',
  amber: 'bg-amber-500 text-stone-950 font-semibold',
};

export function Badge({ variant = 'default', className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', variants[variant], className)}
      {...props}
    >
      {children}
    </span>
  );
}
