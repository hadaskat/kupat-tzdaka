import { describe, test, expect } from 'vitest';
import {
  mapTransaction,
  parseAmount,
  parseTransactionTime,
  isRecurringType,
  isUsd,
} from '../functions/src/nedarim/mapper';
import { buildHistoryUrl, redactUrl } from '../functions/src/nedarim/client';
import { matchFundByName, matchFundInFreeText } from '../functions/src/matching/fundMatcher';

const CREDS = { mosadId: '7014109', apiPassword: 'secret123' };

describe('buildHistoryUrl', () => {
  test('builds the documented GetHistoryJson request', () => {
    const url = buildHistoryUrl(CREDS, { lastId: 12, maxId: 10 });
    expect(url).toContain('https://matara.pro/nedarimplus/Reports/Manage3.aspx?');
    expect(url).toContain('Action=GetHistoryJson');
    expect(url).toContain('MosadId=7014109');
    expect(url).toContain('LastId=12');
    expect(url).toContain('MaxId=10');
  });

  test('omits LastId entirely on a first sync', () => {
    // Their docs: with no LastId the API starts from the first transaction ever.
    expect(buildHistoryUrl(CREDS)).not.toContain('LastId');
  });

  test('the password never survives redaction', () => {
    // The password travels in the query string, so any logged URL must be redacted.
    const redacted = redactUrl(buildHistoryUrl(CREDS, { lastId: 5 }));
    expect(redacted).not.toContain('secret123');
    expect(redacted).toContain('ApiPassword=***');
    expect(redacted).toContain('MosadId=7014109');
  });
});

describe('parseAmount', () => {
  test('accepts numbers, numeric strings and formatted strings', () => {
    expect(parseAmount(180)).toBe(180);
    expect(parseAmount('180')).toBe(180);
    expect(parseAmount('1,800.50')).toBe(1800.5);
    expect(parseAmount('180 ₪')).toBe(180);
  });

  test('unparseable input becomes 0 rather than NaN', () => {
    expect(parseAmount('abc')).toBe(0);
    expect(parseAmount(undefined)).toBe(0);
  });
});

describe('parseTransactionTime', () => {
  test('reads DD/MM/YYYY as Israeli order, not US order', () => {
    // 04/08/2026 is 4 August, not 8 April - getting this backwards would
    // silently file donations in the wrong month.
    const ms = parseTransactionTime('04/08/2026 14:30:00');
    const date = new Date(ms!);
    expect(date.getDate()).toBe(4);
    expect(date.getMonth()).toBe(7);
    expect(date.getFullYear()).toBe(2026);
    expect(date.getHours()).toBe(14);
  });

  test('handles a date with no time, and dash or dot separators', () => {
    expect(new Date(parseTransactionTime('04/08/2026')!).getDate()).toBe(4);
    expect(new Date(parseTransactionTime('04-08-2026')!).getMonth()).toBe(7);
    expect(new Date(parseTransactionTime('04.08.2026')!).getMonth()).toBe(7);
  });

  test('falls back to ISO parsing', () => {
    expect(parseTransactionTime('2026-08-04T14:30:00')).not.toBeNull();
  });

  test('returns null when nothing parses, so the row can be flagged', () => {
    expect(parseTransactionTime('')).toBeNull();
    expect(parseTransactionTime('not a date')).toBeNull();
  });
});

describe('isRecurringType', () => {
  test('a KevaId alone marks a standing order', () => {
    expect(isRecurringType('', '55123')).toBe(true);
  });

  test('recognises the abbreviation the live API actually sends', () => {
    // Observed in real data: the type is `הו"ק`, not the full `הוראת קבע`.
    expect(isRecurringType('הו"ק', null)).toBe(true);
    expect(isRecurringType('הו״ק', null)).toBe(true);
    expect(isRecurringType('הוק', null)).toBe(true);
  });

  test('recognises the full Hebrew and English wording', () => {
    expect(isRecurringType('הוראת קבע', null)).toBe(true);
    expect(isRecurringType('Standing Order', null)).toBe(true);
  });

  test('a one-off or instalment charge is not recurring', () => {
    // "רגיל" is what the live API sends for ordinary donations.
    expect(isRecurringType('רגיל', null)).toBe(false);
    expect(isRecurringType('תשלומים', null)).toBe(false);
  });
});

// Shapes taken verbatim from a live GetHistoryJson response, so a change in
// their format shows up here rather than in production.
describe('real response shape', () => {
  test('every value arrives as a string and still parses', () => {
    const live = {
      TransactionId: '48243256',
      Amount: '186',
      Currency: '1',
      TransactionTime: '13/02/2025 08:50:44',
      Groupe: '',
      TransactionType: 'רגיל',
      ClientName: 'ישראל ישראלי',
    };
    const mapped = mapTransaction(live)!;
    expect(mapped.externalId).toBe('48243256');
    expect(mapped.amount).toBe(186);
    expect(mapped.currency).toBe('ILS');
    expect(mapped.isRecurring).toBe(false);

    const date = new Date(mapped.transactionDate);
    expect(date.getDate()).toBe(13);
    expect(date.getMonth()).toBe(1);
    expect(date.getFullYear()).toBe(2025);
  });

  test('a live standing-order row is detected and linked', () => {
    const live = {
      TransactionId: '48946343',
      Amount: '50',
      Currency: '1',
      TransactionTime: '02/03/2025 02:11:55',
      Groupe: '',
      TransactionType: 'הו"ק',
      KevaId: '1665561',
      ClientName: 'נתן דוד',
    };
    const mapped = mapTransaction(live)!;
    expect(mapped.isRecurring).toBe(true);
    expect(mapped.standingOrderId).toBe('1665561');
  });

  test('an empty Groupe matches no fund, so it lands in the manual queue', () => {
    // This is the current live state - categories are not configured yet.
    expect(matchFundByName('', [{ id: 'f1', name: 'מחזור כ"ב' }])).toBeNull();
  });
});

describe('isUsd', () => {
  test('currency 2 is USD, 1 is shekel', () => {
    expect(isUsd(2)).toBe(true);
    expect(isUsd('2')).toBe(true);
    expect(isUsd(1)).toBe(false);
    expect(isUsd(undefined)).toBe(false);
  });
});

describe('mapTransaction', () => {
  const row = {
    TransactionId: '99881',
    Amount: '360',
    Currency: '1',
    TransactionTime: '04/08/2026 09:15:00',
    Groupe: 'מחזור י"ט מיר ברכפלד',
    Comments: 'לעילוי נשמת',
    ClientName: 'יוסי כהן',
    Zeout: '123456789',
    Phone: '0501234567',
    Mail: 'yossi@example.com',
    Adresse: 'רחוב הרב קוק 5',
    TransactionType: 'רגיל',
    KabalaId: '4471',
    Confirmation: '0012345',
  };

  test('maps every field we rely on', () => {
    const mapped = mapTransaction(row)!;
    expect(mapped.externalId).toBe('99881');
    expect(mapped.amount).toBe(360);
    expect(mapped.currency).toBe('ILS');
    expect(mapped.groupe).toBe('מחזור י"ט מיר ברכפלד');
    expect(mapped.donorName).toBe('יוסי כהן');
    expect(mapped.donorIdNumber).toBe('123456789');
    expect(mapped.receiptId).toBe('4471');
    expect(mapped.isRecurring).toBe(false);
    expect(mapped.transactionDate).toBeGreaterThan(0);
  });

  test('flags a standing order and keeps the link between its charges', () => {
    const mapped = mapTransaction({ ...row, TransactionType: 'הוראת קבע', KevaId: '777' })!;
    expect(mapped.isRecurring).toBe(true);
    expect(mapped.standingOrderId).toBe('777');
  });

  test('marks a dollar donation as USD', () => {
    expect(mapTransaction({ ...row, Currency: '2' })!.currency).toBe('USD');
  });

  test('a row with no transaction id is skipped', () => {
    // Without their id we can neither deduplicate it nor advance the cursor.
    expect(mapTransaction({ ...row, TransactionId: '' })).toBeNull();
  });

  test('a row with no positive amount is skipped', () => {
    expect(mapTransaction({ ...row, Amount: '0' })).toBeNull();
    expect(mapTransaction({ ...row, Amount: 'abc' })).toBeNull();
  });

  test('an unparseable date yields 0 so the sync can flag it, not drop it', () => {
    const mapped = mapTransaction({ ...row, TransactionTime: 'garbage' })!;
    expect(mapped.transactionDate).toBe(0);
    expect(mapped.amount).toBe(360);
  });
});

describe('fund matching', () => {
  const funds = [
    { id: 'f1', name: 'מחזור י"ט מיר ברכפלד' },
    { id: 'f2', name: 'מחזור כ"ב' },
  ];

  test('Groupe matches a fund by name, exactly', () => {
    expect(matchFundByName('מחזור כ"ב', funds)).toEqual({ fundId: 'f2', confidence: 1 });
  });

  test('matching ignores punctuation and spacing differences', () => {
    expect(matchFundByName('מחזור כ״ב  ', funds)?.fundId).toBe('f2');
  });

  test('an unknown or empty category does not match, so it goes to manual review', () => {
    expect(matchFundByName('שיעור שלא קיים', funds)).toBeNull();
    expect(matchFundByName('', funds)).toBeNull();
    expect(matchFundByName(undefined, funds)).toBeNull();
  });

  test('free text matching is a weaker signal, scored below certain', () => {
    const match = matchFundInFreeText('העברה עבור מחזור כ"ב תודה', funds);
    expect(match?.fundId).toBe('f2');
    expect(match!.confidence).toBeLessThan(1);
  });
});
