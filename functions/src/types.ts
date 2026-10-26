export type UserRole = 'superAdmin' | 'fundManager' | 'client';

export type ImportSourceType = 'bankCsv' | 'creditCardCsv' | 'excel';

export type DonationSource =
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
  | 'cancelled';
