import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Offer } from '@fatexia/types';
import { toast } from '@fatexia/ui';
import { getOffer, updateOffer, updateOfferStatus } from '../../lib/offers-api';
import { OfferForm, offerToFormInput } from './OfferForm';

export function EditOffer() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getOffer(id)
      .then(setOffer)
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Failed to load offer'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!offer || !id) return <p className="text-sm text-muted-foreground">Offer not found.</p>;

  return (
    <OfferForm
      heading={`Edit Offer — ${offer.name}`}
      submitLabel="Save Changes"
      submittingLabel="Saving…"
      initial={offerToFormInput(offer)}
      initialStatus={offer.status}
      onSubmit={async (input, status) => {
        await updateOffer(id, input);
        if (status !== offer.status) {
          try {
            await updateOfferStatus(id, status);
          } catch (err) {
            toast.error(
              `Offer saved, but status couldn't be changed to ${status}: ${err instanceof Error ? err.message : 'unknown error'}.`,
            );
            navigate(`/offers/${id}`);
            return;
          }
        }
        toast.success('Offer updated');
        navigate(`/offers/${id}`);
      }}
    />
  );
}
