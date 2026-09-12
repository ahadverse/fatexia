import { Mail, MessageCircle, MessageSquare, Phone, Send, Users } from 'lucide-react';
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

/** A round icon button — the contact grid beside the avatar. */
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

  // Built as a list so the arc can be divided by how many channels actually exist.
  // A channel with no value is left out rather than rendered dead — a mailto: to
  // nowhere, or a t.me link to no one, is worse than an absent button.
  const contacts: { key: string; to?: string; href?: string; label: string; icon: React.ReactNode }[] = [
    { key: 'message', to: '/messages', label: `Message ${badge}`, icon: <MessageSquare className="size-3.5" /> },
  ];
  if (manager.email) {
    contacts.push({ key: 'email', href: `mailto:${manager.email}`, label: `Email ${manager.email}`, icon: <Mail className="size-3.5" /> });
  }
  if (manager.telegram) {
    contacts.push({
      key: 'telegram',
      href: `https://t.me/${manager.telegram.replace(/^@/, '')}`,
      label: `Telegram ${manager.telegram}`,
      icon: <Send className="size-3.5" />,
    });
  }
  if (manager.skype) {
    contacts.push({ key: 'skype', href: `skype:${manager.skype}?chat`, label: `Skype ${manager.skype}`, icon: <MessageCircle className="size-3.5" /> });
  }
  if (manager.teams) {
    contacts.push({
      key: 'teams',
      href: `https://teams.microsoft.com/l/chat/0/0?users=${encodeURIComponent(manager.teams)}`,
      label: `Teams ${manager.teams}`,
      icon: <Users className="size-3.5" />,
    });
  }
  if (manager.phone) {
    contacts.push({ key: 'phone', href: `tel:${manager.phone}`, label: `Call ${manager.phone}`, icon: <Phone className="size-3.5" /> });
  }

  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <p className="text-xs text-muted-foreground">{heading}</p>

      <div className="mt-3 flex items-center gap-3">
        {/* Avatar with the name on a badge across its foot, so the card reads as a
            person rather than a row of contact details. */}
        <div className="relative shrink-0">
          {manager.avatarUrl ? (
            <img src={manager.avatarUrl} alt="" className="size-16 rounded-full object-cover" />
          ) : (
            <div className="flex size-16 items-center justify-center rounded-full bg-primary/15 text-lg font-semibold text-primary">
              {initials(name)}
            </div>
          )}
          <span className="absolute -bottom-1 left-1/2 max-w-[4.5rem] -translate-x-1/2 truncate rounded-full bg-primary px-2 py-0.5 text-center text-[10px] font-semibold text-primary-foreground">
            {badge}
          </span>
        </div>

        {/* Two per row rather than one column: at six channels a single column stands
            three times the avatar's height, and this card sits in a sidebar where that
            vertical space is the scarce thing. Two rows of two matches the avatar. */}
        <div className="grid grid-cols-2 gap-1.5">
          {contacts.map((contact) => (
            <ContactButton key={contact.key} to={contact.to} href={contact.href} label={contact.label}>
              {contact.icon}
            </ContactButton>
          ))}
        </div>
      </div>

      <p className="mt-3 truncate text-xs font-medium text-foreground" title={name}>
        {name}
      </p>
    </div>
  );
}
