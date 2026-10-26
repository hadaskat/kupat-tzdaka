import type {
  DonationStatus,
  LedgerEntryType,
  SupportRequestStatus,
  SupportRequestType,
} from '../types/models';

export function formatCurrency(amount: number): string {
  return `${amount.toLocaleString('he-IL', { maximumFractionDigits: 0 })} ₪`;
}

const LEDGER_TYPE_LABELS: Record<LedgerEntryType, string> = {
  donationIn: 'תרומה',
  commissionIn: 'עמלת תפעול',
  donationReversal: 'ביטול תרומה',
  supportOut: 'תמיכה',
  loanOut: 'הלוואה שניתנה',
  loanRepayment: 'החזר הלוואה',
  adjustment: 'התאמה',
};

export function ledgerTypeLabel(type: LedgerEntryType): string {
  return LEDGER_TYPE_LABELS[type];
}

const REQUEST_STATUS_LABELS: Record<SupportRequestStatus, string> = {
  pending: 'ממתין',
  approved: 'אושר',
  rejected: 'נדחה',
  paid: 'שולם',
  inRepayment: 'בהחזר',
  closed: 'סגור',
};

export function requestStatusLabel(status: SupportRequestStatus): string {
  return REQUEST_STATUS_LABELS[status];
}

const REQUEST_TYPE_LABELS: Record<SupportRequestType, string> = {
  support: 'תמיכה',
  loan: 'הלוואה',
};

export function requestTypeLabel(type: SupportRequestType): string {
  return REQUEST_TYPE_LABELS[type];
}

/** Admin-facing wording, used in the import review queue. */
const DONATION_STATUS_LABELS: Record<DonationStatus, string> = {
  pendingMatch: 'לא שויך',
  matched: 'שויך אוטומטית',
  confirmed: 'אושר',
  rejected: 'נדחה',
  pledged: 'הבטחה',
  cancelled: 'בוטל',
};

export function donationStatusLabel(status: DonationStatus): string {
  return DONATION_STATUS_LABELS[status];
}

/** Donor-facing wording for the same states - a donor shouldn't see internal matching jargon. */
const DONOR_DONATION_STATUS_LABELS: Record<DonationStatus, string> = {
  pendingMatch: 'ממתין לשיוך',
  matched: 'שויך',
  confirmed: 'התקבל',
  rejected: 'נדחה',
  pledged: 'התחייבות',
  cancelled: 'בוטל',
};

export function donorDonationStatusLabel(status: DonationStatus): string {
  return DONOR_DONATION_STATUS_LABELS[status];
}
