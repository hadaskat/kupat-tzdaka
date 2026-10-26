import type { RawTransactionRow } from './types';

const HEADER_ALIASES = {
  date: ['תאריך', 'date'],
  amount: ['סכום', 'amount'],
  message: ['תיאור', 'הודעה', 'הערה', 'message', 'description', 'note'],
  name: ['שם', 'שם משלם', 'payer', 'name'],
} as const;

type FieldKey = keyof typeof HEADER_ALIASES;

function findHeaderKey(headers: string[], field: FieldKey): string | undefined {
  const aliases = HEADER_ALIASES[field].map((a) => a.trim().toLowerCase());
  return headers.find((h) => aliases.includes(h.trim().toLowerCase()));
}

// Excel serial date epoch (1899-12-30) - handles numeric dates from xlsx sheets.
function excelSerialToDate(serial: number): Date {
  const epoch = new Date(Date.UTC(1899, 11, 30));
  return new Date(epoch.getTime() + serial * 86400000);
}

function parseDateValue(value: unknown): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return excelSerialToDate(value).getTime();

  const str = String(value).trim();
  // DD/MM/YYYY or DD-MM-YYYY (common Israeli export format)
  const dmyMatch = str.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    const year = y.length === 2 ? 2000 + Number(y) : Number(y);
    const parsed = new Date(year, Number(m) - 1, Number(d));
    return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
  }

  const parsed = new Date(str);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function parseAmountValue(value: unknown): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return value;
  const cleaned = String(value).replace(/[,\s₪]/g, '');
  const num = Number(cleaned);
  return Number.isNaN(num) ? null : num;
}

export function mapRowsToTransactions(rows: Record<string, unknown>[]): RawTransactionRow[] {
  if (rows.length === 0) return [];
  const headers = Object.keys(rows[0]);

  const dateKey = findHeaderKey(headers, 'date');
  const amountKey = findHeaderKey(headers, 'amount');
  const messageKey = findHeaderKey(headers, 'message');
  const nameKey = findHeaderKey(headers, 'name');

  if (!dateKey || !amountKey) {
    throw new Error(
      'לא נמצאו עמודות תאריך/סכום בקובץ. יש לוודא שהקובץ כולל כותרות "תאריך" ו"סכום".'
    );
  }

  const result: RawTransactionRow[] = [];
  for (const row of rows) {
    const date = parseDateValue(row[dateKey]);
    const amount = parseAmountValue(row[amountKey]);
    if (date == null || amount == null || amount === 0) continue;

    result.push({
      date,
      amount, // signed - callers decide how to interpret direction (deposit vs. charge)
      rawMessage: messageKey ? String(row[messageKey] ?? '').trim() : '',
      counterpartyName: nameKey ? String(row[nameKey] ?? '').trim() || undefined : undefined,
    });
  }
  return result;
}
