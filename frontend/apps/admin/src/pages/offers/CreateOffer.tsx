import { useNavigate } from 'react-router-dom';
import { toast } from '@fatexia/ui';
import { createOffer, updateOfferStatus } from '../../lib/offers-api';
import { OfferForm } from './OfferForm';

export function CreateOffer() {
  const navigate = useNavigate();

  return (
    <OfferForm
      heading="Create Offer"
      submitLabel="Create Offer"
      submittingLabel="Creating…"
      onSubmit={async (input, status) => {
        const created = await createOffer(input);
        // Every offer is created PENDING server-side; a different chosen status is
        // applied as a second step through the real status endpoint, so it still goes
        // through the activation gate (e.g. APPROVED still requires the postback
        // fields to be set) rather than bypassing it via the create payload.
        if (status !== 'PENDING') {
          try {
            await updateOfferStatus(created.id, status);
          } catch (err) {
            toast.error(
              `Offer created, but couldn't be set to ${status}: ${err instanceof Error ? err.message : 'unknown error'}. It was left Pending.`,
            );
            navigate('/offers/all');
            return;
          }
        }
        toast.success('Offer created');
        navigate('/offers/all');
      }}
    />
  );
}
