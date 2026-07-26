'use client';

import {
  CRYPTO_CURRENCIES,
  PAYOUT_METHOD_LABELS,
  networksFor,
  type AffiliatePayoutMethod,
  type CryptoPayoutDetails,
} from '@fatexia/types';
import { Input } from './Input';
import { Select } from './Select';

export interface PayoutMethodFieldsProps {
  method: AffiliatePayoutMethod | '';
  details: CryptoPayoutDetails;
  onMethodChange: (method: AffiliatePayoutMethod | '') => void;
  onDetailsChange: (details: CryptoPayoutDetails) => void;
  /** Offers a "Not set" option — an admin creating an account may not know it yet. */
  allowUnset?: boolean;
  disabled?: boolean;
}

const PAYOUT_METHODS: AffiliatePayoutMethod[] = ['BANK_TRANSFER', 'PAYPAL', 'CRYPTO'];

function Labelled({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={wide ? 'block sm:col-span-2' : 'block'}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

/**
 * Payout method picker, with the crypto sub-fields that only apply to CRYPTO.
 *
 * Lives in the shared package because both the Admin form and the affiliate's own
 * profile must collect the *same* fields under the same rules — the Backend rejects
 * a crypto payout missing coin, network or address regardless of which portal sent
 * it, so two independent implementations would only differ in which one is wrong.
 */
export function PayoutMethodFields({
  method,
  details,
  onMethodChange,
  onDetailsChange,
  allowUnset = true,
  disabled,
}: PayoutMethodFieldsProps) {
  const networks = networksFor(details.cryptoCurrency);

  function changeCurrency(code: string) {
    const next = networksFor(code);
    onDetailsChange({
      ...details,
      cryptoCurrency: code,
      // A network carried over from the previous coin would be unpayable — reset to
      // the new coin's only option when there is exactly one, otherwise force a pick.
      cryptoNetwork: next.includes(details.cryptoNetwork) ? details.cryptoNetwork : (next.length === 1 ? next[0]! : ''),
    });
  }

  return (
    <>
      <Labelled label="Payout method">
        <Select
          value={method}
          disabled={disabled}
          onChange={(event) => onMethodChange(event.target.value as AffiliatePayoutMethod | '')}
        >
          {allowUnset && <option value="">Not set</option>}
          {PAYOUT_METHODS.map((option) => (
            <option key={option} value={option}>
              {PAYOUT_METHOD_LABELS[option]}
            </option>
          ))}
        </Select>
      </Labelled>

      {method === 'CRYPTO' && (
        <>
          <Labelled label="Currency">
            <Select value={details.cryptoCurrency} disabled={disabled} onChange={(event) => changeCurrency(event.target.value)}>
              <option value="">Select a currency</option>
              {CRYPTO_CURRENCIES.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.label}
                </option>
              ))}
            </Select>
          </Labelled>

          <Labelled label="Network">
            <Select
              value={details.cryptoNetwork}
              disabled={disabled || networks.length === 0}
              onChange={(event) => onDetailsChange({ ...details, cryptoNetwork: event.target.value })}
            >
              <option value="">{networks.length === 0 ? 'Select a currency first' : 'Select a network'}</option>
              {networks.map((network) => (
                <option key={network} value={network}>
                  {network}
                </option>
              ))}
            </Select>
          </Labelled>

          <Labelled label="Wallet address" wide>
            <Input
              value={details.walletAddress}
              disabled={disabled}
              spellCheck={false}
              autoComplete="off"
              onChange={(event) => onDetailsChange({ ...details, walletAddress: event.target.value.trim() })}
              placeholder="Paste the receiving address for the selected network"
              className="font-mono text-xs"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Funds sent to an address on the wrong network are unrecoverable — check the network matches your wallet
              before saving.
            </p>
          </Labelled>
        </>
      )}
    </>
  );
}
