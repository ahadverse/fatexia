import { useNavigate } from 'react-router-dom';
import { toast } from '@fatexia/ui';
import { createOffer } from '../../lib/offers-api';
import { OfferForm } from './OfferForm';

export function CreateOffer() {
  const navigate = useNavigate();

  return (
    <OfferForm
      heading="Create Offer"
      submitLabel="Create Offer"
      submittingLabel="Creating…"
      onSubmit={async (input) => {
        await createOffer(input);
        toast.success('Offer created');
        navigate('/offers/all');
      }}
    />
  );
}
