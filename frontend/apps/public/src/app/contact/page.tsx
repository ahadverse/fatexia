'use client';

import { useState, type FormEvent } from 'react';
import { Mail, HelpCircle, Users, Megaphone, Send } from 'lucide-react';
import { Input } from '@fatexia/ui';
import { PageHero, Section } from '@/components/marketing';
import { Reveal } from '@/components/Reveal';

const CONTACT_EMAIL = 'hello@fatexia.com';

const CHANNELS = [
  { icon: Users, title: 'Affiliates', desc: 'Application questions, offers, payouts', email: 'affiliates@fatexia.com' },
  { icon: Megaphone, title: 'Advertisers', desc: 'List an offer or discuss traffic quality', email: 'advertisers@fatexia.com' },
  { icon: HelpCircle, title: 'General', desc: 'Anything else — a real person replies', email: CONTACT_EMAIL },
];

export default function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  // No contact backend endpoint exists, so we don't fake a "sent!" success. Submitting
  // composes a real email in the visitor's own mail client — honest and functional.
  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const body = `Name: ${name}\nEmail: ${email}\n\n${message}`;
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject || 'Website enquiry')}&body=${encodeURIComponent(body)}`;
  }

  return (
    <>
      <PageHero eyebrow="Contact" title="Talk to a real person" description="No ticket-bot maze. Tell us what you need and the right person will get back to you." />

      <Section>
        <div className="grid gap-10 lg:grid-cols-5">
          {/* Channels */}
          <Reveal className="lg:col-span-2">
            <div className="space-y-4">
              {CHANNELS.map((c) => (
                <a
                  key={c.title}
                  href={`mailto:${c.email}`}
                  className="card-hover flex items-start gap-4 rounded-xl border border-border bg-card p-5"
                >
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-brand text-white shadow-[0_8px_24px_-8px_hsl(150_75%_38%/0.8)]">
                    <c.icon className="size-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">{c.title}</div>
                    <div className="text-xs text-muted-foreground">{c.desc}</div>
                    <div className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-primary">
                      <Mail className="size-3.5" />
                      {c.email}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </Reveal>

          {/* Form */}
          <Reveal delay={100} className="lg:col-span-3">
            <form onSubmit={handleSubmit} className="ring-gradient rounded-2xl border border-border bg-card p-6 sm:p-8">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Name</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Email</label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
                </div>
              </div>
              <div className="mt-4 space-y-1.5">
                <label className="text-sm font-medium text-foreground">Subject</label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="What's this about?" />
              </div>
              <div className="mt-4 space-y-1.5">
                <label className="text-sm font-medium text-foreground">Message</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  placeholder="Tell us about your traffic, your offer, or your question…"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <button
                type="submit"
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_8px_30px_-8px_hsl(var(--primary)/0.7)] transition-all hover:brightness-110"
              >
                <Send className="size-4" />
                Send message
              </button>
              <p className="mt-3 text-center text-xs text-muted-foreground">Opens in your email app — or write us directly at {CONTACT_EMAIL}</p>
            </form>
          </Reveal>
        </div>
      </Section>
    </>
  );
}
