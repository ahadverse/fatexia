'use client';

import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';

// Floating "back to top" button — hidden at the top of the page, fades/slides in once
// the visitor has scrolled down, and smooth-scrolls back up on click.
export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 500);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <button
      type="button"
      aria-label="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className={`bg-brand fixed bottom-6 right-6 z-40 flex size-11 items-center justify-center rounded-full text-white shadow-[0_10px_30px_-6px_hsl(150_75%_38%/0.8)] ring-1 ring-inset ring-white/20 transition-all duration-300 hover:-translate-y-0.5 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'
      }`}
    >
      <ArrowUp className="size-5" />
    </button>
  );
}
