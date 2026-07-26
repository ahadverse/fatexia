import type { CSSProperties } from 'react';

// Ambient background: colorful dollar signs gently raining down, each glowing in its
// own colour with an upward text-shadow trail. Pure CSS (keyframes/glow in
// globals.css) — no client JS. Configs are deterministic functions of the index so
// server and client render identically (no hydration mismatch) and the field looks
// scattered without Math.random. Disabled under prefers-reduced-motion.

// A vibrant multi-hue spectrum (emerald, teal, cyan, sky, violet, pink, amber, lime).
// Decorative background only; the UI itself stays green.
const COLORS = [
  '152 76% 55%', // emerald
  '172 80% 52%', // teal
  '190 88% 60%', // cyan
  '212 90% 64%', // sky
  '260 82% 70%', // violet
  '322 82% 66%', // pink
  '40 96% 60%', // amber
  '96 72% 55%', // lime
];

const COUNT = 44;

const DROPS = Array.from({ length: COUNT }, (_, i) => {
  const left = (i * 41 + (i % 6) * 5) % 100; // prime stride → columns don't line up
  const size = 6 + (i % 4) * 2; // 6–12px $ glyphs, small & varied
  const duration = 7 + (i % 9); // 7–15s, varied fall speed
  const delay = -((i * 7) % 18); // negative → mid-flight at load, staggered
  const color = COLORS[i % COLORS.length];
  const op = 0.4 + (i % 5) * 0.12; // 0.40–0.88 peak
  const drift = `${((i % 7) - 3) * 8}px`; // slight sideways sway
  const tailH = `${20 + (i % 5) * 8}px`; // 20–52px comet tail
  return { left, size, duration, delay, color, op, drift, tailH };
});

export function DotRain() {
  return (
    <div aria-hidden className="dot-rain pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {DROPS.map((d, i) => (
        <span
          key={i}
          className="dot-rain__drop"
          style={
            {
              left: `${d.left}%`,
              fontSize: `${d.size}px`,
              animationDuration: `${d.duration}s`,
              animationDelay: `${d.delay}s`,
              '--dot-color': d.color,
              '--dot-op': d.op,
              '--dot-drift': d.drift,
              '--tail-h': d.tailH,
            } as CSSProperties
          }
        >
          $
        </span>
      ))}
    </div>
  );
}
