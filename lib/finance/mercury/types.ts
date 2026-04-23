// Types mirror the actual Mercury API responses captured via live probes
// on 2026-04-23. Keep these in sync with Mercury's actual payload — the raw
// JSON is always stored in mercury_transactions.raw as a safety net.

export type MercuryWorkspace = "business" | "personal";

export interface MercuryOrganization {
  id: string;
  kind: "business" | "personal";
  legalBusinessName: string;
  ein?: string;
  dbas: string[];
}

export interface MercuryAccount {
  id: string;
  accountNumber: string;
  routingNumber: string;
  name: string;
  status: "active" | "archived" | "deleted" | "pending" | string;
  type: "mercury" | "external" | string;
  kind: "checking" | "savings" | "creditCard" | "treasury" | string;
  createdAt: string;
  availableBalance: number;
  currentBalance: number;
  legalBusinessName?: string;
  dashboardLink?: string;
  nickname?: string | null;
}

export type MercuryTransactionStatus =
  | "pending"
  | "sent"
  | "cancelled"
  | "failed"
  | "reversed"
  | "blocked";

export type MercuryTransactionKind =
  | "debitCardTransaction"
  | "externalTransfer"
  | "internalTransfer"
  | "incomingDomesticWire"
  | "outgoingDomesticWire"
  | "incomingInternationalWire"
  | "outgoingInternationalWire"
  | "creditCardTransaction"
  | "other"
  | string;

export interface MercuryTransaction {
  id: string;
  accountId: string;
  feeId: string | null;
  amount: number;
  createdAt: string;
  postedAt: string | null;
  estimatedDeliveryDate: string | null;
  status: MercuryTransactionStatus;
  note: string | null;
  bankDescription: string | null;
  externalMemo: string | null;
  counterpartyId: string | null;
  counterpartyName: string | null;
  counterpartyNickname: string | null;
  kind: MercuryTransactionKind;
  mercuryCategory: string | null;
  merchant: {
    id: string;
    category: string;
    categoryCode: string;
  } | null;
  details: Record<string, unknown>;
  reasonForFailure: string | null;
  failedAt: string | null;
  dashboardLink: string;
  currencyExchangeInfo: Record<string, unknown> | null;
  compliantWithReceiptPolicy: boolean;
  hasGeneratedReceipt: boolean;
  creditAccountPeriodId: string | null;
  generalLedgerCodeName: string | null;
  glAllocations: unknown[];
  attachments: unknown[];
  relatedTransactions: unknown[];
  categoryData: unknown;
  checkNumber: string | null;
  trackingNumber: string | null;
  requestId: string | null;
}

export interface MercuryListAccountsResponse {
  accounts: MercuryAccount[];
  page?: { next?: string };
}

export interface MercuryListTransactionsResponse {
  total: number;
  transactions: MercuryTransaction[];
}

export interface ListTransactionsOptions {
  limit?: number;
  offset?: number;
  start?: string; // YYYY-MM-DD or ISO 8601
  end?: string;
  search?: string;
  status?: MercuryTransactionStatus;
  order?: "asc" | "desc";
}
