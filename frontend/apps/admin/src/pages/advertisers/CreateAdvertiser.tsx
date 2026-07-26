import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, PageHeader, Select, Textarea, toast } from '@fatexia/ui';
import type { AdvertiserStatus } from '@fatexia/types';
import { createAdvertiser } from '../../lib/advertisers-api';

export function CreateAdvertiser() {
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [status, setStatus] = useState<AdvertiserStatus>('ACTIVE');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await createAdvertiser({
        name,
        status,
        contactName: contactName || undefined,
        contactEmail: contactEmail || undefined,
        phone: phone || undefined,
        country: country || undefined,
        websiteUrl: websiteUrl || undefined,
        notes: notes || undefined,
      });
      toast.success(`${name} created`);
      navigate('/advertisers/all');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create advertiser');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <PageHeader
        title="Create advertiser"
        description="Advertisers are company records for now — the advertiser self-service portal is a later phase, so there is no login to provision here."
        actions={
          <>
            <Button type="button" variant="outline" onClick={() => navigate('/advertisers/all')}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Creating…' : 'Create advertiser'}
            </Button>
          </>
        }
      />

      <section className="rounded-lg border border-border bg-card p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Company name</span>
            <Input required value={name} onChange={(event) => setName(event.target.value)} className="mt-1" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Status</span>
            <Select value={status} onChange={(event) => setStatus(event.target.value as AdvertiserStatus)} className="mt-1">
              <option value="ACTIVE">Active</option>
              <option value="PENDING">Pending</option>
              <option value="SUSPENDED">Suspended</option>
            </Select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Contact name</span>
            <Input value={contactName} onChange={(event) => setContactName(event.target.value)} className="mt-1" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Contact email</span>
            <Input type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} className="mt-1" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Phone</span>
            <Input value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-1" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Country</span>
            <Input value={country} onChange={(event) => setCountry(event.target.value)} className="mt-1" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Website</span>
            <Input value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} placeholder="https://example.com" className="mt-1" />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-muted-foreground">Notes</span>
            <Textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-1" />
          </label>
        </div>
      </section>
    </form>
  );
}
