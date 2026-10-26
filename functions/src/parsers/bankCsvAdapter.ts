import Papa from 'papaparse';
import type { ParserAdapter, RawTransactionRow } from './types';
import { mapRowsToTransactions } from './columnMapping';

// Bank exports mix deposits (positive) and withdrawals (negative) in the same
// column - only deposits can be donations, so negative/zero rows are dropped.
export const bankCsvAdapter: ParserAdapter = {
  parse(buffer: Buffer): RawTransactionRow[] {
    const text = buffer.toString('utf-8');
    const { data, errors } = Papa.parse<Record<string, unknown>>(text, {
      header: true,
      skipEmptyLines: true,
    });
    if (errors.length > 0 && data.length === 0) {
      throw new Error(`שגיאה בפענוח קובץ ה-CSV: ${errors[0].message}`);
    }
    return mapRowsToTransactions(data).filter((row) => row.amount > 0);
  },
};
