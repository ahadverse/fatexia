import * as Flags from 'country-flag-icons/react/3x2';
import { cn } from '../lib/cn';

/**
 * An ISO 3166-1 alpha-2 flag, as SVG.
 *
 * Not emoji. `🇮🇹` is the obvious implementation and it is wrong here: Windows ships no
 * flag glyphs at all, so every flag renders as the two letters "IT" in a box — and the
 * admin panel is used on Windows. SVG renders identically everywhere.
 *
 * Bundled rather than fetched from a CDN because the country pickers list ~250 options
 * at once; over the network that is 250 requests every time a dropdown opens.
 */
const FLAGS = Flags as unknown as Record<string, React.ComponentType<{ className?: string; title?: string }>>;

export interface CountryFlagProps {
  /** Two-letter code, any case. An unknown code renders nothing. */
  code: string | null | undefined;
  /** Accessible name, e.g. the country's full name. */
  title?: string;
  className?: string;
}

export function CountryFlag({ code, title, className }: CountryFlagProps) {
  const Flag = code ? FLAGS[code.toUpperCase()] : undefined;
  // Codes that are valid ISO but have no flag in the set (and anything malformed) fall
  // through to nothing rather than an empty box.
  if (!Flag) return null;

  // Fixed aspect: the source SVGs are 3:2, so height follows from width and flags of
  // different real-world proportions still line up in a list.
  return <Flag title={title ?? code ?? undefined} className={cn('h-3 w-[1.125rem] shrink-0 rounded-[2px] object-cover', className)} />;
}
