import Papa from 'papaparse';
import type { ParserAdapter, RawTransactionRow } from './types';
import { mapRowsToTransactions } from './columnMapping';

// Credit-card exports list every charge as a magnitude with no sign
// convention that matters here - every row is a real charge, so only the
// absolute amount is kept (a stray zero-amount row is still dropped upstream).
export const creditCardCsvAdapter: ParserAdapter = {
  parse(buffer: Buffer): RawTransactionRow[] {
    const text = buffer.toString('utf-8');
    const { data, errors } = Papa.parse<Record<string, unknown>>(text, {
      header: true,
      skipEmptyLines: true,
    });
    if (errors.length > 0 && data.length === 0) {
      throw new Error(`שגיאה בפענוח קובץ ה-CSV: ${errors[0].message}`);
    }
    return mapRowsToTransactions(data).map((row) => ({ ...row, amount: Math.abs(row.amount) }));
  },
};
