import * as XLSX from 'xlsx';
import type { ParserAdapter, RawTransactionRow } from './types';
import { mapRowsToTransactions } from './columnMapping';

// Generic Excel export - accepts the same columns as the CSV adapters but
// makes no assumption about sign convention, so both directions are kept as
// deposits (a spreadsheet the admin curated by hand shouldn't silently drop rows).
export const excelAdapter: ParserAdapter = {
  parse(buffer: Buffer): RawTransactionRow[] {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) return [];
    const sheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
    return mapRowsToTransactions(rows).map((row) => ({ ...row, amount: Math.abs(row.amount) }));
  },
};
