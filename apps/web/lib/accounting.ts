import { apiFetch } from '@/lib/api';

// ------------------------------------------------------------ Ledger types
export interface OwnerSummary {
  totals: Record<string, string>;
  net: string;
  currency: string;
  count: number;
}

export interface LedgerEntry {
  id: string;
  propertyId: string;
  mandateId: string | null;
  type: string;
  amount: string;
  currency: string;
  label: string;
  sourceType: string;
  sourceId: string;
  occurredAt: string;
}

export interface LedgerPage {
  data: LedgerEntry[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface StatementItem {
  id: string;
  mandateId: string | null;
  ownerOrgId: string;
  periodStart: string;
  periodEnd: string;
  totals: Record<string, unknown>;
  generatedAt: string;
  url: string | null;
}

export interface AgencyFeeRow {
  mandateId: string | null;
  propertyId: string;
  totalFee: string;
  entryCount: number;
}

export interface AgencyFees {
  data: AgencyFeeRow[];
  total: string;
}

export interface ExpenseFilters {
  status?: string;
}

export interface PublicExpense {
  id: string;
  propertyId: string;
  mandateId: string | null;
  ticketId: string | null;
  category: string;
  label: string;
  amount: string;
  currency: string;
  invoiceKey: string | null;
  status: string;
  createdById: string;
  incurredAt: string;
  createdAt: string;
}

export interface LedgerRange {
  from?: string;
  to?: string;
  propertyId?: string;
}

function rangeParams(filter: LedgerRange): string {
  const params = new URLSearchParams();
  if (filter.from) params.set('from', filter.from);
  if (filter.to) params.set('to', filter.to);
  if (filter.propertyId) params.set('propertyId', filter.propertyId);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

// ------------------------------------------------------------------ Owner
/** GET accounting/owner/summary — totaux par type d'écriture. */
export async function ownerSummary(filter: LedgerRange = {}): Promise<OwnerSummary> {
  return apiFetch<OwnerSummary>(`/accounting/owner/summary${rangeParams(filter)}`);
}

/** GET accounting/owner/ledger — écritures paginées. */
export async function ownerLedger(
  filter: LedgerRange & { page?: number; pageSize?: number } = {},
): Promise<LedgerPage> {
  const params = new URLSearchParams(rangeParams(filter).replace(/^\?/, ''));
  if (filter.page) params.set('page', String(filter.page));
  if (filter.pageSize) params.set('pageSize', String(filter.pageSize));
  const qs = params.toString();
  return apiFetch<LedgerPage>(`/accounting/owner/ledger${qs ? `?${qs}` : ''}`);
}

/** GET accounting/owner/statements — relevés de gérance générés. */
export async function listStatements(): Promise<StatementItem[]> {
  return apiFetch<StatementItem[]>('/accounting/owner/statements');
}

/** POST accounting/owner/statements — génère un relevé PDF pour une période. */
export async function generateStatement(input: {
  mandateId?: string;
  periodStart: string;
  periodEnd: string;
}): Promise<StatementItem> {
  return apiFetch<StatementItem>('/accounting/owner/statements', {
    method: 'POST',
    body: input,
  });
}

// ---------------------------------------------------------------- Agency
/** GET accounting/agency/fees — honoraires par mandat (gérant). */
export async function agencyFees(filter: LedgerRange = {}): Promise<AgencyFees> {
  return apiFetch<AgencyFees>(`/accounting/agency/fees${rangeParams(filter)}`);
}

/** GET accounting/export.csv — export CSV du grand livre (texte brut). */
export async function exportLedgerCsv(filter: LedgerRange = {}): Promise<string> {
  return apiFetch<string>(`/accounting/export.csv${rangeParams(filter)}`);
}

/** Déclenche le téléchargement navigateur d'un CSV déjà produit. */
export function downloadCsv(csv: string, filename = 'ledger.csv'): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// --------------------------------------------------------------- Expenses
/** GET properties/:id/expenses — dépenses d'un bien. */
export async function listExpenses(
  propertyId: string,
  status?: string,
): Promise<PublicExpense[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  return apiFetch<PublicExpense[]>(
    `/properties/${propertyId}/expenses${qs}`,
  );
}

/** POST properties/:id/expenses — création avec facture jointe (multipart). */
export async function createExpense(
  propertyId: string,
  input: {
    category: string;
    label: string;
    amount: number;
    currency?: string;
    incurredAt?: string;
    mandateId?: string;
    draft?: boolean;
    file?: File;
  },
): Promise<PublicExpense> {
  const form = new FormData();
  form.append('category', input.category);
  form.append('label', input.label);
  form.append('amount', String(input.amount));
  if (input.currency) form.append('currency', input.currency);
  if (input.incurredAt) form.append('incurredAt', input.incurredAt);
  if (input.mandateId) form.append('mandateId', input.mandateId);
  if (input.draft) form.append('draft', 'true');
  if (input.file) form.append('file', input.file);
  return apiFetch<PublicExpense>(`/properties/${propertyId}/expenses`, {
    method: 'POST',
    body: form,
  });
}

/** PATCH expenses/:id — modifie un DRAFT/REJETÉ, `submit` pour soumettre. */
export async function updateExpense(
  expenseId: string,
  input: {
    category?: string;
    label?: string;
    amount?: number;
    incurredAt?: string;
    submit?: boolean;
  },
): Promise<PublicExpense> {
  return apiFetch<PublicExpense>(`/expenses/${expenseId}`, {
    method: 'PATCH',
    body: input,
  });
}

// ---------------------------------------------------------------- Labels
export function ledgerTypeLabel(type: string): string {
  const map: Record<string, string> = {
    RENT_IN: 'Loyer encaissé',
    DEPOSIT_IN: 'Dépôt de garantie reçu',
    DEPOSIT_OUT: 'Dépôt de garantie restitué',
    FEE: 'Honoraires agence',
    EXPENSE: 'Dépense',
    PAYOUT: 'Reversement',
    ADJUSTMENT: 'Ajustement',
    REFUND: 'Remboursement',
    STAY_IN: 'Séjour encaissé',
    SALE_IN: 'Vente encaissée',
  };
  return map[type] ?? type;
}

export function ledgerTypeTone(type: string): 'success' | 'danger' | 'neutral' {
  const debits = new Set(['FEE', 'EXPENSE', 'PAYOUT', 'REFUND', 'DEPOSIT_OUT']);
  if (debits.has(type)) return 'danger';
  if (type === 'RENT_IN' || type === 'STAY_IN' || type === 'SALE_IN') {
    return 'success';
  }
  return 'neutral';
}

export function expenseStatusLabel(status: string): string {
  const map: Record<string, string> = {
    DRAFT: 'Brouillon',
    PENDING_APPROVAL: 'En attente d’approbation',
    APPROVED: 'Approuvée',
    REJECTED: 'Rejetée',
    PAID: 'Payée',
  };
  return map[status] ?? status;
}

export function expenseCategoryLabel(category: string): string {
  const map: Record<string, string> = {
    REPAIR: 'Travaux',
    TAX: 'Taxe',
    INSURANCE: 'Assurance',
    UTILITIES: 'Charges',
    OTHER: 'Autre',
  };
  return map[category] ?? category;
}

export function formatAmount(value: string | number, currency = 'XAF'): string {
  const amount = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(amount)) return String(value);
  return `${new Intl.NumberFormat('fr-FR').format(amount)} ${currency}`;
}
