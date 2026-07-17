export interface ExpenseItem {
  id: string;
  category: string;
  description: string;
  amount: number; // stored in USD
  completed: boolean;
  type?: "income" | "expense"; // Defaults to 'expense' if not specified
  originalAmount?: number;
  originalCurrency?: string;
  originalRate?: number;
}

export interface MonthlyBudget {
  monthStr: string; // YYYY-MM
  income: number; // monthly income in USD
  expenses: ExpenseItem[];
}

export interface DebtPayment {
  id: string;
  amount: number;
  createdAt: string;
}

export interface DebtItem {
  id: string;
  name: string;
  totalAmount: number;
  createdAt: string;
  payments: DebtPayment[];
}

export interface FinanceData {
  baselineMonthlyIncome: number; // default monthly income in USD
  baselineBalance: number; // initial savings/balance in USD
  monthlyBudgets: MonthlyBudget[];
  activeMonths?: string[]; // stored in database
  debts?: DebtItem[];
}
