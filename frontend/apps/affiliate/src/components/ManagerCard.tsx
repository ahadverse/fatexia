import { useState } from 'react';
import { Check, Copy, Mail, MessagesSquare, Phone, Send } from 'lucide-react';
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

const AVATAR = 96;
const BUTTON = 28;
// Centre of each button sits on a circle just outside the avatar's edge.
const RADIUS = AVATAR / 2 + BUTTON / 2 - 2;

const BUTTON_CLASS =
  'flex items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

interface Contact {
  key: string;
  label: string;
  icon: React.ReactNode;
  href?: string;
  /** Teams: no reliable one-click target on every device, so it reveals the address instead. */
  teamsAddress?: string;
}

/** Where the arc of buttons sits: spread evenly over the avatar's right-hand side. */
function arcStyle(index: number, count: number): React.CSSProperties {
  const span = Math.min(40 * (count - 1), 120);
  const angle = count === 1 ? 0 : -span / 2 + (span / (count - 1)) * index;
  const rad = (angle * Math.PI) / 180;
  return {
    position: 'absolute',
    width: BUTTON,
    height: BUTTON,
    left: AVATAR / 2 + RADIUS * Math.cos(rad) - BUTTON / 2,
    top: AVATAR / 2 + RADIUS * Math.sin(rad) - BUTTON / 2,
  };
}

function TeamsButton({ address, label, style }: { address: string; label: string; style: React.CSSProperties }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  function copy() {
    void navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div style={style} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onFocus={() => setOpen(true)}
        className={`${BUTTON_CLASS} size-full`}
      >
        <MessagesSquare className="size-3.5" />
      </button>
      {open && (
        // Padded on the left (not margined) so the pointer can cross from the button
        // to the popup without leaving the hover area.
        <div className="absolute left-full top-1/2 z-50 -translate-y-1/2 pl-2">
          <div className="flex items-center gap-2 whitespace-nowrap rounded-md border border-border bg-card px-3 py-2 text-sm shadow-lg">
            <a
              href={`https://teams.microsoft.com/l/chat/0/0?users=${encodeURIComponent(address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2"
            >
              {address}
            </a>
            <button
              type="button"
              onClick={copy}
              aria-label="Copy Teams address"
              title="Copy"
              className="text-primary transition-opacity hover:opacity-70"
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </button>
          </div>
        </div>
      )}
    </div>
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
  const heading = manager.managerRole ? ROLE_LABELS[manager.managerRole] : 'Account manager';

  // A channel with no value is left out rather than rendered dead — a mailto: to
  // nowhere, or a t.me link to no one, is worse than an absent button.
  const contacts: Contact[] = [];
  if (manager.email) {
    contacts.push({ key: 'email', href: `mailto:${manager.email}`, label: `Email ${manager.email}`, icon: <Mail className="size-3.5" /> });
  }
  if (manager.teams) {
    contacts.push({ key: 'teams', teamsAddress: manager.teams, label: `Microsoft Teams — ${manager.teams}`, icon: null });
  }
  if (manager.telegram) {
    contacts.push({
      key: 'telegram',
      href: `https://t.me/${manager.telegram.replace(/^@/, '')}`,
      label: `Telegram ${manager.telegram}`,
      icon: <Send className="size-3.5" />,
    });
  }
  if (manager.phone) {
    contacts.push({ key: 'phone', href: `tel:${manager.phone}`, label: `Call ${manager.phone}`, icon: <Phone className="size-3.5" /> });
  }

  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <p className="text-xs text-muted-foreground">{heading}</p>

      {/* The arc of buttons hangs off the avatar's right edge, so the box is the avatar
          plus half a button of overhang. */}
      <div className="relative mt-3" style={{ width: AVATAR + BUTTON, height: AVATAR }}>
        <div className="absolute left-0 top-0 overflow-hidden rounded-full" style={{ width: AVATAR, height: AVATAR }}>
          {manager.avatarUrl ? (
            <img src={manager.avatarUrl} alt="" className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center bg-primary/15 text-2xl font-semibold text-primary">
              {initials(name)}
            </div>
          )}
          <span
            className="absolute inset-x-0 bottom-0 truncate bg-black/50 px-2 pb-1.5 pt-1 text-center text-xs font-semibold text-white"
            title={name}
          >
            {name}
          </span>
        </div>

        {contacts.map((contact, index) => {
          const style = arcStyle(index, contacts.length);
          if (contact.teamsAddress) {
            return <TeamsButton key={contact.key} address={contact.teamsAddress} label={contact.label} style={style} />;
          }
          return (
            <a
              key={contact.key}
              href={contact.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={contact.label}
              title={contact.label}
              className={BUTTON_CLASS}
              style={style}
            >
              {contact.icon}
            </a>
          );
        })}
      </div>
    </div>
  );
}
