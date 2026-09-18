/**
 * Tipos da API do Pluggy — escritos a partir do retorno REAL observado
 * (608 transações, 2 contas), não da documentação.
 *
 * Campos marcados `| null` foram observados nulos na prática, mesmo quando a
 * documentação os descreve como preenchidos. `balance` e `amountInAccountCurrency`,
 * por exemplo, vieram nulos em 100% dos casos — só instituições diretas os enviam.
 */

export type PluggyDocumentNumber = {
  type: string; // CPF | CNPJ
  value: string;
};

export type PluggyParty = {
  name: string | null;
  documentNumber: PluggyDocumentNumber;
  accountNumber: string | null;
  branchNumber: string | null;
  routingNumber: string | null;
  routingNumberISPB: string | null;
};

export type PluggyPaymentData = {
  payer: PluggyParty | null;
  receiver: PluggyParty | null;
  paymentMethod: string; // PIX | OTHER
  reason: string | null;
  referenceNumber: string | null;
};

export type PluggyMerchant = {
  name: string;
  businessName: string;
  cnpj: string;
  cnae: string;
  category: string;
};

export type PluggyTransaction = {
  id: string;
  accountId: string;
  amount: number;
  currencyCode: string;
  date: string;
  description: string;
  descriptionRaw: string | null;
  type: 'DEBIT' | 'CREDIT';
  status: 'POSTED' | 'PENDING';
  category: string | null;
  categoryId: string | null;
  balance: number | null;
  merchant: PluggyMerchant | null;
  paymentData: PluggyPaymentData | null;
  operationType: string | null;
  operationTypeAdditionalInfo: string | null;
  providerId: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
};

export type PluggyAccount = {
  id: string;
  itemId: string;
  type: 'BANK' | 'CREDIT';
  subtype: string;
  name: string;
  marketingName: string | null;
  number: string;
  balance: number;
  currencyCode: string;
  taxNumber: string | null;
  owner: string | null;
  bankData: {
    transferNumber: string | null;
    closingBalance: number | null;
    overdraftContractedLimit: number | null;
    overdraftUsedLimit: number | null;
  } | null;
  creditData: {
    brand: string | null;
    level: string | null;
    creditLimit: number | null;
    availableCreditLimit: number | null;
    balanceCloseDate: string | null;
    balanceDueDate: string | null;
  } | null;
};

export type PluggyItem = {
  id: string;
  status: string;
  executionStatus: string;
  lastUpdatedAt: string | null;
  nextAutoSyncAt: string | null;
  consentExpiresAt: string | null;
  error: { code: string; message: string } | null;
  connector: { id: number; name: string; imageUrl: string | null; isOpenFinance: boolean };
};

// ─────────────────────────────────────────── linhas prontas para o banco

export type TransactionRow = {
  externalId: string;
  source: 'pluggy';
  accountExternalId: string;
  /** Sinal do Kairo: negativo = saída. Cartão de crédito já normalizado. */
  amountCents: number;
  currencyCode: string;
  date: string;
  status: 'POSTED' | 'PENDING';
  description: string;
  descriptionRaw: string | null;
  merchantFingerprint: string;
  merchantDisplayName: string;
  merchantCnpj: string | null;
  merchantCnae: string | null;
  externalCategory: string | null;
  categoryName: string | null;
  operationType: string | null;
  paymentMethod: string | null;
  isInternalTransfer: boolean;
  transferPairKey: string | null;
  transferDetectedBy: 'document' | 'amount-match' | null;
  raw: PluggyTransaction;
};
