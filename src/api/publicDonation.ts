import { useEffect, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';

export interface PublicFund {
  id: string;
  name: string;
  description: string;
}

/**
 * Fund list for the guest donation screen. Comes from a callable rather than a
 * Firestore listener because this screen runs without authentication.
 */
export function usePublicFunds() {
  const [funds, setFunds] = useState<PublicFund[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fn = httpsCallable<void, { funds: PublicFund[] }>(functions, 'listPublicFunds');

    fn()
      .then((res) => {
        if (cancelled) return;
        setFunds(res.data.funds);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError('לא ניתן לטעון את רשימת הקרנות');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { funds, loading, error };
}

export interface GuestDonationParams {
  fundId: string;
  amount: number;
  fullName: string;
  phone?: string;
  email?: string;
  isRecurring?: boolean;
  note?: string;
}

export function createGuestDonation(params: GuestDonationParams) {
  const fn = httpsCallable<GuestDonationParams, { donationId: string; personId: string }>(
    functions,
    'createGuestDonation'
  );
  return fn(params);
}
