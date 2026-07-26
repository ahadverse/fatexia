import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/* ---------------------------------------------------------------- Button ---- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost';
type ButtonSize = 'md' | 'lg';

const BUTTON_BASE =
  'relative overflow-hidden inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60';

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary:
    'btn-shine bg-brand text-white shadow-[0_10px_34px_-8px_hsl(150_75%_38%/0.7)] hover:shadow-[0_14px_40px_-6px_hsl(150_80%_40%/0.95)] hover:brightness-110',
  secondary: 'border border-white/12 bg-white/[0.04] text-foreground backdrop-blur hover:border-primary/50 hover:bg-white/[0.07]',
  ghost: 'text-muted-foreground hover:text-foreground',
};

const BUTTON_SIZE: Record<ButtonSize, string> = {
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-6 py-3 text-sm sm:text-base',
};

export function ButtonLink({
  href,
  children,
  variant = 'primary',
  size = 'md',
  withArrow = false,
  className,
}: {
  href: string;
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  withArrow?: boolean;
  className?: string;
}) {
  return (
    <Link href={href} className={cx(BUTTON_BASE, BUTTON_VARIANT[variant], BUTTON_SIZE[size], className)}>
      {children}
      {withArrow && <ArrowRight className="size-4" />}
    </Link>
  );
}

/* --------------------------------------------------------------- Eyebrow ---- */

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cx('eyebrow', className)}>
      <span className="dot-pulse size-1.5 rounded-full bg-brand" />
      {children}
    </span>
  );
}

/* -------------------------------------------------------- SectionHeading ---- */

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'center',
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: 'center' | 'left';
  className?: string;
}) {
  return (
    <div className={cx(align === 'center' ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl', className)}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 className={cx('text-3xl font-bold tracking-tight text-gradient sm:text-4xl', eyebrow && 'mt-4')}>{title}</h2>
      {description && <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">{description}</p>}
    </div>
  );
}

/* -------------------------------------------------------------- PageHero ---- */

export function PageHero({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <GlowBackdrop />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 mask-fade bg-grid opacity-30" />
      <div className="container-page py-20 text-center sm:py-24">
        <div className="flex justify-center">
          <Eyebrow>{eyebrow}</Eyebrow>
        </div>
        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight text-gradient sm:text-5xl">{title}</h1>
        {description && <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">{description}</p>}
        {children && <div className="mt-8 flex flex-wrap items-center justify-center gap-4">{children}</div>}
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- Section ---- */

type SectionTone = 'default' | 'muted';

export function Section({
  children,
  id,
  tone = 'default',
  className,
  pattern,
  glow = false,
}: {
  children: React.ReactNode;
  id?: string;
  tone?: SectionTone;
  className?: string;
  pattern?: 'grid' | 'dots';
  glow?: boolean;
}) {
  return (
    <section id={id} className={cx('relative overflow-hidden border-t border-white/5 py-20 sm:py-28', tone === 'muted' && 'bg-card/25', className)}>
      {pattern && <div aria-hidden className={cx('pointer-events-none absolute inset-0 -z-10 mask-fade opacity-60', pattern === 'grid' ? 'bg-grid' : 'bg-dots')} />}
      {glow && (
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[440px] w-[820px] -translate-x-1/2 opacity-50 blur-3xl"
          style={{ background: 'radial-gradient(closest-side, hsl(150 78% 40% / 0.25), transparent)' }}
        />
      )}
      <div className="container-page">{children}</div>
    </section>
  );
}

/* --------------------------------------------------------- GlowBackdrop ---- */

export function GlowBackdrop({ className }: { className?: string }) {
  return <div aria-hidden className={cx('aurora pointer-events-none absolute inset-x-0 -top-52 -z-10 h-[680px] opacity-70 blur-3xl', className)} />;
}

/* ------------------------------------------------------------ FeatureCard ---- */

export function FeatureCard({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <div className="group card-hover sheen relative overflow-hidden rounded-2xl border border-white/10 bg-card/80 p-6">
      <div className="flex size-11 items-center justify-center rounded-xl bg-brand text-white shadow-[0_8px_24px_-8px_hsl(150_75%_38%/0.8)]">
        <Icon className="size-5" />
      </div>
      <h3 className="mt-5 text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 size-28 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: 'radial-gradient(circle, hsl(150 78% 45% / 0.4), transparent 70%)' }}
      />
    </div>
  );
}

/* ----------------------------------------------------------- VerticalCard ---- */

export function VerticalCard({ icon: Icon, name, blurb, tags }: { icon: LucideIcon; name: string; blurb: string; tags: string[] }) {
  return (
    <div className="card-hover sheen flex flex-col rounded-2xl border border-white/10 bg-card/80 p-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-brand text-white shadow-[0_8px_24px_-8px_hsl(150_75%_38%/0.8)]">
          <Icon className="size-5" />
        </div>
        <h3 className="text-base font-semibold text-foreground">{name}</h3>
      </div>
      <p className="mt-4 flex-1 text-sm leading-relaxed text-muted-foreground">{blurb}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        {tags.map((t) => (
          <span key={t} className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- StatBand ---- */

export function StatBand({ stats }: { stats: { value: string; label: string; sub: string }[] }) {
  return (
    <div className="border-brand relative grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="sheen relative bg-card/90 p-6 text-center sm:text-left">
          <div className="text-2xl font-bold text-brand sm:text-3xl">{s.value}</div>
          <div className="mt-1 text-sm font-semibold text-foreground">{s.label}</div>
          <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{s.sub}</div>
        </div>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- CTABanner ---- */

export function CTABanner({
  title,
  description,
  primaryHref = '/register',
  primaryLabel = 'Become an Affiliate',
  secondaryHref,
  secondaryLabel,
}: {
  title: React.ReactNode;
  description: string;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  return (
    <div className="border-brand relative overflow-hidden rounded-3xl border border-white/10 bg-card px-6 py-16 text-center sm:px-12">
      <div aria-hidden className="aurora pointer-events-none absolute inset-0 -z-10 opacity-90" />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 mask-fade bg-grid opacity-30" />
      <h2 className="mx-auto max-w-2xl text-2xl font-bold tracking-tight text-gradient sm:text-4xl">{title}</h2>
      <p className="mx-auto mt-4 max-w-xl text-muted-foreground">{description}</p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <ButtonLink href={primaryHref} size="lg" withArrow>
          {primaryLabel}
        </ButtonLink>
        {secondaryHref && secondaryLabel && (
          <ButtonLink href={secondaryHref} variant="secondary" size="lg">
            {secondaryLabel}
          </ButtonLink>
        )}
      </div>
    </div>
  );
}
