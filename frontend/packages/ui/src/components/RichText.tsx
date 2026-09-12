'use client';

import DOMPurify from 'dompurify';
import { useMemo } from 'react';
import { cn } from '../lib/cn';

/**
 * Renders HTML authored in the admin's rich-text editor.
 *
 * Sanitised on every render, not on save. Trusting stored HTML means one bad row —
 * written before a rule tightened, or by an account that should not have had the
 * permission — is served to every affiliate who opens that offer. Sanitising at the
 * point of display is the only place that covers rows already in the database.
 *
 * "The admin wrote it" is not sufficient reason to skip this: a manager with
 * `offers.edit` can author an offer description, and it is displayed to every affiliate
 * who can see the offer. A `<script>` or an `onerror` attribute there would run in
 * their session.
 *
 * The allowlist is deliberately narrow — the editor's own toolbar can only produce
 * these — and `style` is permitted only so the colour the author picked survives.
 */
const ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'u', 's', 'ul', 'ol', 'li', 'h3', 'h4', 'blockquote', 'span', 'a', 'code'];
const ALLOWED_ATTR = ['style', 'href', 'target', 'rel'];

export interface RichTextProps {
  html: string | null | undefined;
  className?: string;
}

export function RichText({ html, className }: RichTextProps) {
  const clean = useMemo(() => {
    if (!html) return '';
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS,
      ALLOWED_ATTR,
      // Any link in a description points somewhere outside this portal.
      ADD_ATTR: ['target'],
    });
  }, [html]);

  if (!clean) return null;

  // `prose`-style spacing written out rather than pulled from a plugin: this is the
  // only place the app renders authored HTML, and the tag set is six items long.
  return (
    <div
      className={cn(
        'text-sm leading-relaxed [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3',
        '[&_h3]:mt-3 [&_h3]:text-base [&_h3]:font-semibold [&_h4]:mt-3 [&_h4]:font-semibold',
        '[&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_p:not(:first-child)]:mt-2',
        className,
      )}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
