import { NEDARIM_MAX_PAGE, type NedarimTransaction } from './types';

export const NEDARIM_URL = 'https://matara.pro/nedarimplus/Reports/Manage3.aspx';

export interface NedarimCredentials {
  mosadId: string;
  apiPassword: string;
}

export interface FetchPageOptions {
  /** Return transactions AFTER this id (exclusive). Omit to start from the first ever. */
  lastId?: string | number;
  maxId?: number;
}

/**
 * Their API takes the password as a query parameter, so the full URL is a
 * secret. This builds a redacted copy for logs and error messages - the raw
 * URL must never be logged.
 */
export function redactUrl(url: string): string {
  return url.replace(/(ApiPassword=)[^&]*/i, '$1***');
}

export function buildHistoryUrl(
  credentials: NedarimCredentials,
  options: FetchPageOptions = {}
): string {
  const params = new URLSearchParams({
    Action: 'GetHistoryJson',
    MosadId: credentials.mosadId,
    ApiPassword: credentials.apiPassword,
    MaxId: String(options.maxId ?? NEDARIM_MAX_PAGE),
  });
  // Omitting LastId means "from the very first transaction" per their docs.
  if (options.lastId !== undefined && options.lastId !== null && options.lastId !== '') {
    params.set('LastId', String(options.lastId));
  }
  return `${NEDARIM_URL}?${params.toString()}`;
}

/**
 * The document says the response is an array. It does not promise a content
 * type, and ASP.NET endpoints sometimes return JSON as text/html or wrap it,
 * so the body is parsed leniently and a clear error is raised otherwise.
 */
function parseTransactions(body: string): NedarimTransaction[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    const preview = body.slice(0, 200).replace(/\s+/g, ' ');
    throw new Error(`תשובת נדרים פלוס אינה JSON תקין. תחילת התשובה: ${preview}`);
  }

  if (Array.isArray(parsed)) return parsed as NedarimTransaction[];

  // Tolerate a wrapper object if they ever add one.
  if (parsed && typeof parsed === 'object') {
    for (const key of ['Data', 'data', 'Result', 'result', 'Transactions']) {
      const inner = (parsed as Record<string, unknown>)[key];
      if (Array.isArray(inner)) return inner as NedarimTransaction[];
    }
    const asRecord = parsed as Record<string, unknown>;
    if (asRecord.Message || asRecord.Error) {
      throw new Error(`נדרים פלוס החזירו שגיאה: ${asRecord.Message ?? asRecord.Error}`);
    }
  }

  throw new Error('תשובת נדרים פלוס אינה במבנה הצפוי (מערך עסקאות)');
}

export async function fetchHistoryPage(
  credentials: NedarimCredentials,
  options: FetchPageOptions = {}
): Promise<NedarimTransaction[]> {
  const url = buildHistoryUrl(credentials, options);

  let response: Response;
  try {
    response = await fetch(url, { method: 'GET' });
  } catch (error) {
    throw new Error(
      `לא ניתן להתחבר לנדרים פלוס (${redactUrl(url)}): ${(error as Error).message}`
    );
  }

  if (!response.ok) {
    throw new Error(`נדרים פלוס החזירו שגיאה ${response.status} עבור ${redactUrl(url)}`);
  }

  return parseTransactions(await response.text());
}

export interface FetchAllResult {
  transactions: NedarimTransaction[];
  /** The highest TransactionId seen - the cursor for the next sync. */
  lastId: string | null;
  pages: number;
  /** True when the safety cap stopped the loop before the data ran out. */
  truncated: boolean;
}

/**
 * Walks the whole history from `startAfterId` forward, following their
 * LastId cursor. `maxPages` is a safety stop so a misbehaving cursor can
 * never spin forever.
 */
export async function fetchAllSince(
  credentials: NedarimCredentials,
  startAfterId?: string | number,
  { pageSize = NEDARIM_MAX_PAGE, maxPages = 50 } = {}
): Promise<FetchAllResult> {
  const transactions: NedarimTransaction[] = [];
  let cursor = startAfterId;
  let pages = 0;

  while (pages < maxPages) {
    const page = await fetchHistoryPage(credentials, { lastId: cursor, maxId: pageSize });
    pages++;
    if (page.length === 0) break;

    transactions.push(...page);

    const lastRow = page[page.length - 1];
    const nextCursor = lastRow?.TransactionId;
    // Without a usable cursor another request would re-fetch the same page.
    if (nextCursor === undefined || nextCursor === null || String(nextCursor) === String(cursor)) {
      break;
    }
    cursor = nextCursor;

    if (page.length < pageSize) break;
  }

  return {
    transactions,
    lastId: cursor !== undefined && cursor !== null ? String(cursor) : null,
    pages,
    truncated: pages >= maxPages,
  };
}
