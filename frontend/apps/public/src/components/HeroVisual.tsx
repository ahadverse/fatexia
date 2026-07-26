import { Smartphone, Monitor, ShieldCheck, Activity, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// A stylised preview of the Fatexia tracker console — an interface illustration (like
// a product screenshot), showing the fraud pipeline scoring sample clicks ALLOW /
// REVIEW / BLOCK. The rows are illustrative sample data, not live network stats, so
// nothing here fabricates a track record (see PLAN-public-portal.md honesty note).

type Verdict = 'ALLOW' | 'REVIEW' | 'BLOCK';

interface ClickRow {
  country: string;
  source: string;
  device: LucideIcon;
  verdict: Verdict;
}

const FEED: ClickRow[] = [
  { country: 'US', source: 'Facebook', device: Smartphone, verdict: 'ALLOW' },
  { country: 'IN', source: 'Push', device: Smartphone, verdict: 'REVIEW' },
  { country: 'DE', source: 'Native', device: Monitor, verdict: 'ALLOW' },
  { country: 'BR', source: 'Pop', device: Smartphone, verdict: 'BLOCK' },
  { country: 'GB', source: 'Search', device: Monitor, verdict: 'ALLOW' },
  { country: 'PH', source: 'Push', device: Smartphone, verdict: 'REVIEW' },
  { country: 'ID', source: 'Native', device: Smartphone, verdict: 'ALLOW' },
  { country: 'FR', source: 'Email', device: Monitor, verdict: 'ALLOW' },
];

const VERDICT_STYLE: Record<Verdict, string> = {
  ALLOW: 'bg-success/15 text-success ring-success/25',
  REVIEW: 'bg-warning/15 text-warning ring-warning/25',
  BLOCK: 'bg-destructive/15 text-destructive ring-destructive/25',
};

// Bar heights for the breathing throughput chart (percent of track).
const BARS = [42, 66, 38, 74, 52, 88, 60, 46, 78, 56, 70, 48];

function FeedRow({ row }: { row: ClickRow }) {
  const Device = row.device;
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/60 px-3 py-2">
      <span className="flex size-6 items-center justify-center rounded bg-secondary text-[10px] font-bold text-muted-foreground">{row.country}</span>
      <span className="flex-1 text-xs font-medium text-foreground">{row.source}</span>
      <Device className="size-3.5 text-muted-foreground" />
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset ${VERDICT_STYLE[row.verdict]}`}>{row.verdict}</span>
    </div>
  );
}

export function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-md lg:mx-0">
      {/* Ambient glow + slow conic sweep behind the card */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-8 -z-10 opacity-60 blur-3xl"
        style={{ background: 'radial-gradient(420px circle at 60% 30%, hsl(var(--primary) / 0.4), transparent 70%)' }}
      />
      <div aria-hidden className="pointer-events-none absolute -inset-10 -z-10 flex items-center justify-center opacity-20">
        <div
          className="size-[420px] animate-spin-slow rounded-full"
          style={{ background: 'conic-gradient(from 0deg, transparent, hsl(var(--primary) / 0.5), transparent 55%)' }}
        />
      </div>

      {/* Console card — subtle 3D tilt that straightens on hover */}
      <div className="group animate-float [perspective:1400px]">
        <div className="ring-gradient overflow-hidden rounded-2xl border border-border bg-card/90 shadow-2xl backdrop-blur transition-transform duration-700 lg:[transform:rotateY(-8deg)_rotateX(3deg)] lg:group-hover:[transform:none]">
          {/* Title bar */}
          <div className="flex items-center gap-2 border-b border-border bg-background/40 px-4 py-3">
            <span className="size-2.5 rounded-full bg-destructive/70" />
            <span className="size-2.5 rounded-full bg-warning/70" />
            <span className="size-2.5 rounded-full bg-success/70" />
            <span className="ml-2 text-xs font-semibold text-foreground">Fatexia Tracker</span>
            <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-success/70" />
                <span className="relative inline-flex size-2 rounded-full bg-success" />
              </span>
              Live
            </span>
          </div>

          <div className="space-y-4 p-4">
            {/* Capability chips */}
            <div className="flex flex-wrap gap-2">
              {[
                { icon: Activity, label: 'Real-time' },
                { icon: ShieldCheck, label: '3-layer fraud' },
                { icon: Wallet, label: 'Rule-based payout' },
              ].map((c) => (
                <span key={c.label} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-2 py-1 text-[11px] font-medium text-muted-foreground">
                  <c.icon className="size-3 text-primary" />
                  {c.label}
                </span>
              ))}
            </div>

            {/* Throughput mini chart */}
            <div className="rounded-xl border border-border bg-background/50 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-muted-foreground">Throughput</span>
                <span className="text-[11px] font-semibold text-primary">clicks scored</span>
              </div>
              <div className="mt-3 flex h-16 items-end gap-1.5">
                {BARS.map((h, i) => (
                  <div
                    key={i}
                    className="animate-bar flex-1 rounded-sm bg-gradient-to-t from-primary/40 to-primary"
                    style={{ height: `${h}%`, animationDelay: `${i * 0.14}s` }}
                  />
                ))}
              </div>
            </div>

            {/* Live-ish feed */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-medium text-muted-foreground">Incoming clicks</span>
                <div className="flex items-center gap-2 text-[10px] font-medium">
                  <span className="inline-flex items-center gap-1 text-success"><span className="size-1.5 rounded-full bg-success" />Allow</span>
                  <span className="inline-flex items-center gap-1 text-warning"><span className="size-1.5 rounded-full bg-warning" />Review</span>
                  <span className="inline-flex items-center gap-1 text-destructive"><span className="size-1.5 rounded-full bg-destructive" />Block</span>
                </div>
              </div>
              <div className="relative h-[168px] overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,#000_12%,#000_88%,transparent)]">
                <div className="animate-marquee-y space-y-2">
                  {[...FEED, ...FEED].map((row, i) => (
                    <FeedRow key={i} row={row} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center gap-2 border-t border-border bg-background/40 px-4 py-3">
            <Wallet className="size-3.5 text-primary" />
            <span className="text-[11px] text-muted-foreground">
              Payout <span className="font-semibold text-foreground">computed from the offer rule</span> — never trusted from the postback
            </span>
          </div>
        </div>
      </div>

      {/* Floating accent chips for depth */}
      <div className="absolute -left-4 top-16 hidden animate-float rounded-xl border border-border bg-card/90 px-3 py-2 shadow-xl backdrop-blur [animation-delay:-2s] sm:block">
        <div className="text-[10px] text-muted-foreground">Click ID</div>
        <div className="font-mono text-xs font-semibold text-foreground">98b2…a981</div>
      </div>
      <div className="absolute -right-3 bottom-20 hidden animate-float rounded-xl border border-border bg-card/90 px-3 py-2 shadow-xl backdrop-blur [animation-delay:-4s] sm:block">
        <div className="text-[10px] text-muted-foreground">Conversion</div>
        <div className="inline-flex items-center gap-1 text-xs font-semibold text-success">
          <ShieldCheck className="size-3.5" /> Verified
        </div>
      </div>
    </div>
  );
}
