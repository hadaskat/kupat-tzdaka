import { CURRENCY_USD, type NedarimTransaction } from './types';

export interface MappedDonation {
  /** Their transaction id - our dedupe key and sync cursor. */
  externalId: string;
  amount: number;
  currency: 'ILS' | 'USD';
  transactionDate: number;
  /** The category they returned; matched against fund names. */
  groupe: string;
  comments: string;
  donorName: string;
  donorIdNumber: string | null;
  donorPhone: string | null;
  donorEmail: string | null;
  donorAddress: string | null;
  isRecurring: boolean;
  /** Links every charge belonging to the same standing order. */
  standingOrderId: string | null;
  /** Receipt number issued by Nedarim Plus. */
  receiptId: string | null;
  confirmation: string | null;
}

function str(value: unknown): string {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function strOrNull(value: unknown): string | null {
  const s = str(value);
  return s === '' ? null : s;
}

/** Their numbers may arrive as strings, and may carry commas or a currency sign. */
export function parseAmount(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const cleaned = str(value).replace(/[,\s₪$]/g, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * The document does not state the date format. Israeli systems usually emit
 * DD/MM/YYYY, which `new Date()` misreads as US MM/DD/YYYY - so that shape is
 * parsed explicitly first, and only then do we fall back to Date.parse.
 * Returns null when nothing parses, so the caller can flag the row instead of
 * silently recording a wrong date.
 */
export function parseTransactionTime(value: unknown): number | null {
  const raw = str(value);
  if (!raw) return null;

  const dmy = raw.match(
    /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/
  );
  if (dmy) {
    const [, d, m, y, hh = '0', mm = '0', ss = '0'] = dmy;
    const date = new Date(
      Number(y),
      Number(m) - 1,
      Number(d),
      Number(hh),
      Number(mm),
      Number(ss)
    );
    return Number.isNaN(date.getTime()) ? null : date.getTime();
  }

  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Their TransactionType is free text. Live data uses the abbreviation `הו"ק`
 * rather than the full `הוראת קבע`, and the quote character varies, so the
 * value is stripped of punctuation before matching.
 *
 * A KevaId is the stronger signal and is checked first - but the text check
 * still matters, in case a standing order ever arrives without one.
 */
export function isRecurringType(transactionType: unknown, kevaId: unknown): boolean {
  if (strOrNull(kevaId)) return true;

  const t = str(transactionType)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
  return (
    t.includes('קבע') || t.includes('הוק') || t.includes('keva') || t.includes('standing')
  );
}

export function isUsd(currency: unknown): boolean {
  return parseAmount(currency) === CURRENCY_USD;
}

/**
 * Converts one Nedarim Plus row into our shape. Returns null when the row has
 * no usable transaction id or no positive amount - such a row cannot be
 * deduplicated or booked, so importing it would do more harm than skipping it.
 */
export function mapTransaction(tx: NedarimTransaction): MappedDonation | null {
  const externalId = str(tx.TransactionId);
  if (!externalId) return null;

  const amount = parseAmount(tx.Amount);
  if (amount <= 0) return null;

  const transactionDate = parseTransactionTime(tx.TransactionTime);

  return {
    externalId,
    amount,
    currency: isUsd(tx.Currency) ? 'USD' : 'ILS',
    // Falling back to "now" would be a lie about when the money arrived, but a
    // missing date must not drop a real donation - the sync flags these.
    transactionDate: transactionDate ?? 0,
    groupe: str(tx.Groupe),
    comments: str(tx.Comments),
    donorName: str(tx.ClientName),
    donorIdNumber: strOrNull(tx.Zeout),
    donorPhone: strOrNull(tx.Phone),
    donorEmail: strOrNull(tx.Mail),
    donorAddress: strOrNull(tx.Adresse),
    isRecurring: isRecurringType(tx.TransactionType, tx.KevaId),
    standingOrderId: strOrNull(tx.KevaId),
    receiptId: strOrNull(tx.KabalaId),
    confirmation: strOrNull(tx.Confirmation),
  };
}
