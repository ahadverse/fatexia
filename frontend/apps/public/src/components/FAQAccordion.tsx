'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Faq } from '@/lib/content';

export function FAQAccordion({ items, className }: { items: Faq[]; className?: string }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className={['divide-y divide-border overflow-hidden rounded-xl border border-border bg-card', className].filter(Boolean).join(' ')}>
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={item.question}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-accent/50"
            >
              <span className="text-sm font-semibold text-foreground sm:text-base">{item.question}</span>
              <ChevronDown className={['size-5 shrink-0 text-muted-foreground transition-transform duration-300', isOpen ? 'rotate-180 text-primary' : ''].join(' ')} />
            </button>
            <div className={['grid transition-all duration-300 ease-out', isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'].join(' ')}>
              <div className="overflow-hidden">
                <p className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground">{item.answer}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
