import { useEffect, useState, type FormEvent } from 'react';
import type { OfferCategory } from '@fatexia/types';
import { Input, toast } from '@fatexia/ui';
import { getOfferCategories, createOfferCategory } from '../../lib/offer-categories-api';

export function Categories() {
  const [categories, setCategories] = useState<OfferCategory[] | null>(null);
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function reload() {
    getOfferCategories().then(setCategories);
  }

  useEffect(reload, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await createOfferCategory(name.trim());
      setName('');
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create category');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-md space-y-6">
      <h1 className="text-2xl font-semibold">Offer Categories</h1>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input placeholder="Category name" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit" disabled={submitting} className="shrink-0 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">
          Add
        </button>
      </form>

      <div className="rounded-lg border border-border bg-card p-4">
        {categories === null && <p className="text-sm text-muted-foreground">Loading…</p>}
        {categories?.length === 0 && <p className="text-sm text-muted-foreground">No categories yet.</p>}
        <ul className="space-y-2">
          {categories?.map((c) => (
            <li key={c.id} className="text-sm text-card-foreground">
              {c.name}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
