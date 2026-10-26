/**
 * superAdmin  - full control; the ONLY role that may approve/confirm anything (spec §3).
 * fundManager - supervisor. Read-only, scoped to the funds listed in `fundIds`.
 *               Exists to give "two eyes" oversight without operational power.
 * client      - donor and/or beneficiary.
 */
export type UserRole = 'superAdmin' | 'fundManager' | 'client';

export interface AppUser {
  uid: string;
  role: UserRole;
  username: string;
  fullName: string;
  phone?: string;
  idNumber?: string;
  /** Funds a fundManager may view. Ignored for other roles. */
  fundIds?: string[];
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface OrgSettings {
  orgName: string;
  /** ח"פ / מספר עמותה */
  orgNumber: string;
  section46CertNumber: string;
  /** epoch ms */
  section46ValidUntil?: number;
  /** Operating commission taken from app/Nedarim Plus donations (spec §5). */
  commissionPercentage: number;
  /** Nedarim Plus institution number. The API password lives in Firebase Secrets. */
  nedarimMosadId: string;
  updatedBy?: string;
  updatedAt: number;
}

export interface NedarimSyncSummary {
  fetched: number;
  created: number;
  duplicates: number;
  skipped: number;
  unmatchedFund: number;
  usd: number;
  missingDate: number;
}

export interface NedarimSyncState {
  lastTransactionId: string | null;
  lastSyncAt: number | null;
  lastSyncBy: string | null;
  lastResult: NedarimSyncSummary | null;
  lastError: string | null;
}

export interface Fund {
  id: string;
  name: string;
  description?: string;
  /**
   * The one operating/general fund ("כללי"). Every other fund belongs to a
   * shiur. There is deliberately no further categorisation - money flows both
   * in and out of every fund, so labelling them by purpose was meaningless.
   */
  isGeneralFund: boolean;
  balance: number;
  currency: 'ILS';
  active: boolean;
  /** Set when the fund was closed rather than deleted, because it had history. */
  closedAt?: number;
  closedBy?: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export type LedgerEntryType =
  | 'donationIn'
  /** The commission slice routed to the general/operating fund (spec §5). */
  | 'commissionIn'
  | 'donationReversal'
  | 'supportOut'
  | 'loanOut'
  | 'loanRepayment'
  | 'adjustment';

export interface LedgerEntry {
  id: string;
  fundId: string;
  type: LedgerEntryType;
  amount: number;
  balanceAfter: number;
  relatedDonationId?: string;
  relatedRequestId?: string;
  createdBy: string;
  createdAt: number;
  note?: string;
}

/**
 * One record per human being (spec §4.7). The same person is frequently both a
 * donor and a beneficiary, so the roles are flags on a single card rather than
 * two separate collections - that way their whole history shows in one place.
 */
export interface Person {
  id: string;
  /** Set when this person also has an app login. */
  linkedUserId?: string;
  fullName: string;
  phone?: string;
  email?: string;
  idNumber?: string;
  address?: string;
  notes?: string;
  isDonor: boolean;
  isBeneficiary: boolean;
  totalDonated: number;
  totalReceived: number;
  /** Normalized name, used for lookup and duplicate detection. */
  searchName: string;
  createdAt: number;
  updatedAt?: number;
}

export type DonationSource =
  /** Donor picked the fund in the app and paid via Nedarim Plus - commission applies. */
  | 'nedarimPlus'
  | 'bankImport'
  | 'creditCardImport'
  | 'manualAdmin'
  | 'clientPledge';

export type DonationStatus =
  | 'pendingMatch'
  | 'matched'
  | 'confirmed'
  | 'rejected'
  | 'pledged'
  /** Chargeback / standing-order cancellation. Never deleted - a credit note is issued (spec §4.3.1). */
  | 'cancelled';

export interface Donation {
  id: string;
  fundId: string;
  /** The unified People record this donation is credited to. */
  personId?: string;
  clientUserId?: string;
  /** Payer name exactly as it appeared in the bank/credit-card file, before matching. */
  donorNameRaw?: string;
  /** Contact details captured for the receipt when a guest donates without an account. */
  guestContact?: { phone?: string; email?: string };
  /** Standing order (הוראת קבע) rather than a one-off donation. */
  isRecurring?: boolean;
  /** What the donor actually paid. Receipts are always issued on this amount. */
  grossAmount: number;
  /** Credited to the designated fund (gross minus commission). */
  netAmount: number;
  /** Operating commission routed to the general fund. Zero for bank/Excel donations. */
  feeAmount: number;
  /** Nedarim Plus's own clearing fee - reported as an expense, NOT deducted from the fund (spec §4.3.1). */
  nedarimPlusFee?: number;
  /** Funds are kept in shekels; a USD donation is held aside rather than converted. */
  currency: 'ILS' | 'USD';
  transactionDate: number;
  source: DonationSource;
  rawMessage?: string;
  status: DonationStatus;
  matchConfidence?: number;
  possibleDuplicate?: boolean;
  dedupeKey: string;
  /** The provider's own transaction id (Nedarim Plus TransactionId). */
  externalId?: string;
  /** Receipt number issued by the provider, if any. */
  externalReceiptId?: string;
  confirmation?: string;
  /** Links every charge of the same standing order. */
  standingOrderId?: string | null;
  /** Set when the provider's date could not be parsed - needs a human look. */
  needsDateReview?: boolean;
  importedFileId?: string;
  confirmedBy?: string;
  confirmedAt?: number;
  createdAt: number;
}

export type SupportRequestType = 'support' | 'loan';

export type SupportRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'paid'
  | 'inRepayment'
  | 'closed';

export interface LoanTerms {
  installments: number;
  dueDates: number[];
}

export interface SupportRequest {
  id: string;
  type: SupportRequestType;
  clientUserId: string;
  clientName?: string;
  /** The unified People record credited when the support is actually paid out. */
  personId?: string;
  fundId: string;
  requestedAmount: number;
  approvedAmount?: number;
  repaidAmount?: number;
  reason: string;
  attachments?: string[];
  status: SupportRequestStatus;
  loanTerms?: LoanTerms;
  reviewedBy?: string;
  reviewedAt?: number;
  paidAt?: number;
  createdAt: number;
}

export interface AuditEntry {
  id: string;
  adminId: string;
  action: string;
  entity: string;
  entityId: string;
  fundId?: string | null;
  details?: Record<string, unknown> | null;
  timestamp: number;
}

export type ImportSourceType = 'bankCsv' | 'creditCardCsv' | 'excel';

export type ImportedFileStatus = 'uploaded' | 'parsing' | 'parsed' | 'failed';

export interface ImportedFile {
  id: string;
  fileName: string;
  storagePath: string;
  sourceType: ImportSourceType;
  uploadedBy: string;
  uploadedAt: number;
  status: ImportedFileStatus;
  rowCount?: number;
  matchedCount?: number;
  unmatchedCount?: number;
  errorLog?: string;
}
