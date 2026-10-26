import { createHash } from 'crypto';

export function buildDedupeKey(params: {
  transactionDate: number;
  amount: number;
  rawMessage?: string;
  source: string;
}): string {
  const raw = `${params.transactionDate}|${params.amount}|${params.rawMessage ?? ''}|${params.source}`;
  return createHash('sha256').update(raw).digest('hex');
}
