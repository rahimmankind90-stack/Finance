export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
  ADV = 'ADV',
  TRF = 'TRF'
}

export enum TransactionStatus {
  CLEARED = 'CLEARED',
  PENDING = 'PENDING',
  RECONCILED = 'RECONCILED'
}

export interface ChartOfAccountItem {
  code: string;
  category: string;
  isHeader?: boolean;
}

export interface Transaction {
  id: string;
  date: string;
  voucherNumber: string;
  chequeNumber?: string;
  activity?: string; // Added field
  description: string;
  payeeOrPayer: string;
  amount: number;
  type: TransactionType;
  accountCode: string; // Links to ChartOfAccountItem.code
  status: TransactionStatus;
}

export interface BankTransaction {
  id: string;
  date: string;
  description: string;
  amount: number; // Positive for deposit, negative for withdrawal
  matchedTransactionId?: string;
}

export interface BudgetLine {
  code: string;
  monthlyBudget: number;
}