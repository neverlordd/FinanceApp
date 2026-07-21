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
  actualEndingBalance?: number;
}

export interface DebtPayment {
  id: string;
  amount: number;
  createdAt: string;
  sourceExpenseId?: string;
  sourceMonthStr?: string;
}

export interface DebtItem {
  id: string;
  name: string;
  totalAmount: number;
  createdAt: string;
  payments: DebtPayment[];
}

export interface ExpenseTemplate {
  id: string;
  title: string;
  category: string;
  amount?: number;
  originalAmount?: number;
  originalCurrency?: string;
  originalRate?: number;
  source: "recurring" | "debt";
}

export interface ExpenseTemplateOverride {
  templateId: string;
  title?: string;
  category?: string;
  amount?: number | null;
  hidden?: boolean;
}

export interface WorkoutExercise {
  id: string;
  title: string;
  muscleGroup: string;
  sets?: number;
  reps?: string;
  setup: string;
  technique: string;
  important?: string;
  completed: boolean;
}

export interface WorkoutDay {
  id: string;
  name: string;
  focus: string;
  exercises: WorkoutExercise[];
}

export interface WorkoutWeek {
  id: string;
  startDate: string;
  title: string;
  days: WorkoutDay[];
}

export interface FinanceData {
  baselineMonthlyIncome: number; // default monthly income in USD
  baselineBalance: number; // initial savings/balance in USD
  monthlyBudgets: MonthlyBudget[];
  activeMonths?: string[]; // stored in database
  debts?: DebtItem[];
  expenseTemplateOverrides?: ExpenseTemplateOverride[];
  workoutWeeks?: WorkoutWeek[];
}
