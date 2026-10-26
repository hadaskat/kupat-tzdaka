import type { ParserAdapter } from './types';
import { bankCsvAdapter } from './bankCsvAdapter';
import { creditCardCsvAdapter } from './creditCardCsvAdapter';
import { excelAdapter } from './excelAdapter';

export type { ParserAdapter, RawTransactionRow } from './types';

const ADAPTERS: Record<string, ParserAdapter> = {
  bankCsv: bankCsvAdapter,
  creditCardCsv: creditCardCsvAdapter,
  excel: excelAdapter,
};

export function getAdapterForSourceType(sourceType: string): ParserAdapter {
  const adapter = ADAPTERS[sourceType];
  if (!adapter) {
    throw new Error(`סוג קובץ לא נתמך: ${sourceType}`);
  }
  return adapter;
}
