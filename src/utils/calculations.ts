import { FinanceData, ExpenseItem } from "../types";

export interface CalculatedMonth {
  monthStr: string; // YYYY-MM
  monthName: string; // "AUGUST"
  monthYear: string; // "2026"
  isCurrent: boolean;
  isPast: boolean;
  isFuture: boolean;
  baseIncome: number; // baseline monthly income or customized base income
  income: number; // TOTAL income = baseIncome + any items of type === 'income'
  expenses: ExpenseItem[];
  totalExpenses: number; // USD (only items of type !== 'income')
  completedExpenses: number; // USD (only items of type !== 'income' and completed)
  net: number; // USD (income - totalExpenses)
  startingSavings: number; // cumulative from prior months + baselineBalance
  projectedEndingSavings: number;
  actualEndingBalance?: number;
  endingSavings: number; // actual balance when set, otherwise startingSavings + net
}

export const getEnglishMonthName = (monthStr: string): { name: string; year: string } => {
  const [year, month] = monthStr.split('-');
  const months = [
    "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
    "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"
  ];
  const index = parseInt(month, 10) - 1;
  return {
    name: months[index] || "MONTH",
    year
  };
};

// Generates an array of months starting from a given month (or 2 months before current) up to 12 months ahead
export const getMonthSequence = (data: FinanceData, currentMonthStr: string): string[] => {
  if (data.activeMonths && data.activeMonths.length > 0) {
    return [...data.activeMonths].sort();
  }

  const monthsSet = new Set<string>();

  // 1. Add months that have custom budgets
  data.monthlyBudgets.forEach(b => {
    monthsSet.add(b.monthStr);
  });

  // 2. Add current month
  monthsSet.add(currentMonthStr);

  // 3. Add 2 months in the past
  let [currY, currM] = currentMonthStr.split('-').map(Number);
  for (let i = 1; i <= 2; i++) {
    let m = currM - i;
    let y = currY;
    if (m <= 0) {
      m += 12;
      y -= 1;
    }
    monthsSet.add(`${y}-${String(m).padStart(2, '0')}`);
  }

  // 4. Add 12 months in the future
  for (let i = 1; i <= 12; i++) {
    let m = currM + i;
    let y = currY;
    while (m > 12) {
      m -= 12;
      y += 1;
    }
    monthsSet.add(`${y}-${String(m).padStart(2, '0')}`);
  }

  return Array.from(monthsSet).sort();
};

export const calculateMonthlyStats = (data: FinanceData, currentMonthStr: string): CalculatedMonth[] => {
  const monthSequence = getMonthSequence(data, currentMonthStr);
  const calculated: CalculatedMonth[] = [];
  const budgetsByMonth = new Map(data.monthlyBudgets.map(budget => [budget.monthStr, budget]));

  let runningSavings = data.baselineBalance || 0;

  for (let i = 0; i < monthSequence.length; i++) {
    const monthStr = monthSequence[i];
    const isCurrent = monthStr === currentMonthStr;
    const isPast = monthStr < currentMonthStr;
    const isFuture = monthStr > currentMonthStr;

    // Find custom budget for this month
    const budget = budgetsByMonth.get(monthStr);

    // Base monthly income defaults to baseline if not customized
    const baseIncome = budget && typeof budget.income === 'number' ? budget.income : data.baselineMonthlyIncome;

    // All items (both incomes and expenses) for this month
    const expenses = budget ? budget.expenses : [];

    let itemizedIncomes = 0;
    let totalExpenses = 0;
    let completedExpenses = 0;
    for (const item of expenses) {
      if (item.type === "income") {
        itemizedIncomes += item.amount;
      } else {
        totalExpenses += item.amount;
        if (item.completed) completedExpenses += item.amount;
      }
    }

    // Total income = base monthly income + itemized additional incomes
    const income = baseIncome + itemizedIncomes;

    const net = income - totalExpenses;
    const startingSavings = runningSavings;
    const projectedEndingSavings = startingSavings + net;
    const actualEndingBalance = budget && Number.isFinite(budget.actualEndingBalance)
      ? budget.actualEndingBalance
      : undefined;
    const endingSavings = actualEndingBalance ?? projectedEndingSavings;

    const { name, year } = getEnglishMonthName(monthStr);

    calculated.push({
      monthStr,
      monthName: name,
      monthYear: year,
      isCurrent,
      isPast,
      isFuture,
      baseIncome,
      income,
      expenses,
      totalExpenses,
      completedExpenses,
      net,
      startingSavings,
      projectedEndingSavings,
      actualEndingBalance,
      endingSavings
    });

    runningSavings = endingSavings;
  }

  return calculated;
};
