import { Mail, MessageSquare, Phone, Send } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { AffiliateManagerContact } from '@fatexia/types';

const ROLE_LABELS: Record<'GENERAL' | 'ACCOUNT' | 'AFFILIATE', string> = {
  GENERAL: 'General manager',
  ACCOUNT: 'Account manager',
  AFFILIATE: 'Affiliate manager',
};

function initials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/** A round icon button — the contact rail down the right of the avatar. */
function ContactButton({
  href,
  to,
  label,
  children,
}: {
  href?: string;
  to?: string;
  label: string;
  children: React.ReactNode;
}) {
  const className =
    'flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
  if (to) {
    return (
      <Link to={to} aria-label={label} title={label} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} aria-label={label} title={label} className={className}>
      {children}
    </a>
  );
}

/**
 * Issue #6 — who to talk to, pinned under the nav.
 *
 * It earns that spot because issue #7 moved payout details out of the affiliate's own
 * hands: "message your manager" is now the answer to a question they will actually
 * have, so the manager's name has to be somewhere they always are.
 *
 * One card design for everyone. An affiliate with no assigned manager gets the
 * network's support desk back from the server rather than null (see
 * managerService.getContactForAffiliate) — most affiliates are in that state, so a
 * separate bare-paragraph branch for them would mean the majority never see the
 * designed card at all.
 */
export function ManagerCard({
  manager,
  loading,
}: {
  manager: AffiliateManagerContact | null;
  loading: boolean;
}) {
  if (loading || !manager) {
    return <div className="h-36 animate-pulse rounded-lg bg-muted" aria-hidden="true" />;
  }

  const name = manager.fullName ?? manager.email;
  // The badge across the avatar holds a first name; a support desk has no first name,
  // so it gets the network's name instead of an awkward "Fatexia".
  const badge = manager.kind === 'MANAGER' ? (manager.fullName?.split(' ')[0] ?? 'Manager') : 'Support';
  const heading = manager.managerRole ? ROLE_LABELS[manager.managerRole] : 'Account manager';

  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <p className="text-xs text-muted-foreground">{heading}</p>

      <div className="mt-3 flex items-center gap-3">
        {/* Avatar with the name on a badge across its foot, so the card reads as a
              person rather than a row of contact details. */}
        <div className="relative shrink-0">
          <div className="flex size-16 items-center justify-center rounded-full bg-primary/15 text-lg font-semibold text-primary">
            {initials(name)}
          </div>
          <span className="absolute -bottom-1 left-1/2 max-w-[4.5rem] -translate-x-1/2 truncate rounded-full bg-primary px-2 py-0.5 text-center text-[10px] font-semibold text-primary-foreground">
            {badge}
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <ContactButton to="/messages" label={`Message ${badge}`}>
            <MessageSquare className="size-3.5" />
          </ContactButton>
          {/* Email is skipped rather than rendered dead when the network has no
                support address configured — a mailto: to nowhere is worse than absent. */}
          {manager.email && (
            <ContactButton href={`mailto:${manager.email}`} label={`Email ${manager.email}`}>
              <Mail className="size-3.5" />
            </ContactButton>
          )}
          {manager.skype && (
            <ContactButton href={`skype:${manager.skype}?chat`} label={`Skype ${manager.skype}`}>
              <Send className="size-3.5" />
            </ContactButton>
          )}
          {manager.phone && (
            <ContactButton href={`tel:${manager.phone}`} label={`Call ${manager.phone}`}>
              <Phone className="size-3.5" />
            </ContactButton>
          )}
        </div>
      </div>

      <p className="mt-3 truncate text-xs font-medium text-foreground" title={name}>
        {name}
      </p>
      {manager.publicId && <p className="font-mono text-[11px] text-muted-foreground">{manager.publicId}</p>}
    </div>
  );
}
