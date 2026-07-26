'use client';

import * as Switch from '@radix-ui/react-switch';
import { cn } from '../lib/cn';

export interface ToggleProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export function Toggle({ checked, onCheckedChange, label, disabled, className }: ToggleProps) {
  return (
    <label className={cn('flex items-center gap-2 text-sm text-foreground', className)}>
      <Switch.Root
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className={cn(
          'relative h-5 w-9 shrink-0 rounded-full bg-input transition-colors data-[state=checked]:bg-primary',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        <Switch.Thumb className="block size-4 translate-x-0.5 rounded-full bg-background transition-transform data-[state=checked]:translate-x-[18px]" />
      </Switch.Root>
      {label}
    </label>
  );
}
