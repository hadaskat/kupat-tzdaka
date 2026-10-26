export interface RawTransactionRow {
  date: number; // epoch ms
  amount: number;
  rawMessage: string;
  counterpartyName?: string;
}

export interface ParserAdapter {
  parse(buffer: Buffer): RawTransactionRow[];
}
