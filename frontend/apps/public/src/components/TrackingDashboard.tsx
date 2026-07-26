import { Fingerprint, Globe2, Smartphone, MonitorSmartphone, Radio, Network, MapPin, Clock, ShieldCheck, Check, Activity, Search } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// A dashboard-style illustration of what the tracker records for a single click. The
// fields mirror the real `clicks` schema (ip, geo, device/os/browser, asn, datacenter
// & proxy flags, risk score, quality status, click_id); values are illustrative sample
// data, like a product screenshot — not live network stats. See PLAN-public-portal.md.

interface Prop {
  icon: LucideIcon;
  label: string;
  value: string;
  mono?: boolean;
}

const PROPERTIES: Prop[] = [
  { icon: Fingerprint, label: 'Click ID', value: '98b2c…a981', mono: true },
  { icon: Globe2, label: 'Country', value: 'United States · US' },
  { icon: Smartphone, label: 'Device', value: 'Mobile' },
  { icon: MonitorSmartphone, label: 'OS · Browser', value: 'iOS 17 · Safari' },
  { icon: Radio, label: 'Traffic source', value: 'Facebook' },
  { icon: Network, label: 'ASN', value: 'AS7922 · Consumer ISP' },
  { icon: MapPin, label: 'IP address', value: '203.0.113.•••', mono: true },
  { icon: Clock, label: 'Seen at', value: '12:04:37 UTC' },
];

const SIGNALS = [
  { label: 'Datacenter / hosting', result: 'Clean', tone: 'ok' as const },
  { label: 'Residential proxy / VPN', result: 'Clean', tone: 'ok' as const },
  { label: 'Click-to-conversion time', result: 'At conversion', tone: 'pending' as const },
];

const SCHEMA = ['click_id', 'ip', 'country', 'device', 'os', 'browser', 'asn', 'datacenter', 'proxy_vpn', 'risk_score', 'quality_status', 'offer_id', 'affiliate_id', 'ctit'];

const RISK = 12; // sample click risk score (low = good)

export function TrackingDashboard() {
  return (
    <div className="border-brand relative overflow-hidden rounded-3xl border border-white/10 bg-card/80 shadow-2xl">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 mask-fade bg-grid opacity-40" />

      {/* Window chrome */}
      <div className="flex items-center gap-3 border-b border-white/10 bg-background/50 px-5 py-3.5">
        <span className="size-3 rounded-full bg-destructive/70" />
        <span className="size-3 rounded-full bg-warning/70" />
        <span className="size-3 rounded-full bg-success/70" />
        <span className="ml-2 text-sm font-semibold text-foreground">Click Explorer</span>
        <div className="ml-4 hidden items-center gap-2 rounded-md border border-white/10 bg-background/60 px-2.5 py-1 text-xs text-muted-foreground sm:flex">
          <Search className="size-3.5" />
          click_id: 98b2c…a981
        </div>
        <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-success/70" />
            <span className="relative inline-flex size-2 rounded-full bg-success" />
          </span>
          Live
        </span>
      </div>

      {/* Body */}
      <div className="grid gap-5 p-5 lg:grid-cols-3">
        {/* Captured properties */}
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Activity className="size-3.5 text-primary" /> Captured properties
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {PROPERTIES.map((p) => (
              <div key={p.label} className="flex items-center gap-3 rounded-xl border border-white/10 bg-background/50 px-3.5 py-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-inset ring-primary/20">
                  <p.icon className="size-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{p.label}</div>
                  <div className={`truncate text-sm font-semibold text-foreground ${p.mono ? 'font-mono' : ''}`}>{p.value}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Schema chips */}
          <div className="mt-4 rounded-xl border border-white/10 bg-background/40 p-3.5">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Recorded on every click</div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {SCHEMA.map((f) => (
                <span key={f} className="rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 font-mono text-[11px] text-primary">
                  {f}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Scoring column */}
        <div className="space-y-4">
          {/* Risk gauge */}
          <div className="sheen rounded-2xl border border-white/10 bg-background/50 p-5 text-center">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Risk score</div>
            <div className="relative mx-auto mt-3 size-28">
              <div
                className="size-28 rounded-full"
                style={{ background: `conic-gradient(hsl(var(--success)) ${RISK * 3.6}deg, hsl(var(--border)) 0deg)` }}
              />
              <div className="absolute inset-[10px] flex flex-col items-center justify-center rounded-full bg-card">
                <span className="text-3xl font-bold text-foreground">{RISK}</span>
                <span className="text-[10px] text-muted-foreground">/ 100</span>
              </div>
            </div>
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-success ring-1 ring-inset ring-success/25">
              <ShieldCheck className="size-3.5" /> Good
            </div>
          </div>

          {/* Fraud signals */}
          <div className="sheen rounded-2xl border border-white/10 bg-background/50 p-4">
            <div className="mb-3 text-[11px] uppercase tracking-wide text-muted-foreground">Fraud signals</div>
            <div className="space-y-2.5">
              {SIGNALS.map((s) => (
                <div key={s.label} className="flex items-center justify-between gap-3">
                  <span className="text-xs text-foreground">{s.label}</span>
                  {s.tone === 'ok' ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success">
                      <Check className="size-3" /> {s.result}
                    </span>
                  ) : (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{s.result}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
