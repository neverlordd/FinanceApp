import React, { useState, useEffect } from "react";
import { CalculatedMonth } from "../utils/calculations";
import { ExpenseItem, ExpenseTemplate } from "../types";
import {
  Wallet,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Edit3,
  Trash2,
  Check,
  Coins,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  TrendingDown,
  Sparkles,
  CheckCircle2,
  HelpCircle,
  DollarSign,
  Briefcase,
  AlertCircle,
  Calendar,
  ChevronDown
} from "lucide-react";

interface DashboardViewProps {
  calculatedMonths: CalculatedMonth[];
  selectedMonthStr: string;
  onSetSelectedMonthStr: (month: string) => void;
  onUpdateMonthIncome: (monthStr: string, income: number) => void;
  onAddExpense: (monthStr: string, expense: Omit<ExpenseItem, 'id'> & { originalAmount?: number; originalCurrency?: string; originalRate?: number }) => void;
  onEditExpense: (monthStr: string, expense: ExpenseItem & { originalAmount?: number; originalCurrency?: string; originalRate?: number }) => void;
  onDeleteExpense: (monthStr: string, expenseId: string) => void;
  onToggleExpenseCompleted: (monthStr: string, expenseId: string) => void;
  expenseTemplates: ExpenseTemplate[];
  onAddMonth?: () => void;
  onDeleteMonth?: (monthStr: string) => void;
  triggerConfirm: (title: string, message: string, onConfirm: () => void) => void;
  triggerAlert: (title: string, message: string) => void;
}

// Preset rates for converter (how many units per 1 USD)
const DEFAULT_RATES: Record<string, number> = {
  USD: 1.0,
  RUB: 90.0,
  GEL: 2.7,
  EUR: 0.92,
  KZT: 450.0
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  RUB: "₽",
  GEL: "₾",
  EUR: "€",
  KZT: "₸"
};

const EXPENSE_CATEGORIES = [
  "Housing",
  "Living",
  "Entertainment",
  "Subscriptions",
  "Transport",
  "Debt",
  "Other"
];

const INCOME_CATEGORIES = [
  "Salary",
  "Freelance",
  "Crypto",
  "Investments",
  "Gifts",
  "Other"
];

const normalizeTemplateTitle = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase();

export const DashboardView: React.FC<DashboardViewProps> = ({
  calculatedMonths,
  selectedMonthStr,
  onSetSelectedMonthStr,
  onUpdateMonthIncome,
  onAddExpense,
  onEditExpense,
  onDeleteExpense,
  onToggleExpenseCompleted,
  expenseTemplates,
  onAddMonth,
  onDeleteMonth,
  triggerConfirm,
  triggerAlert
}) => {
  // Find currently selected month details
  const activeIndex = calculatedMonths.findIndex(m => m.monthStr === selectedMonthStr);
  const currentMonth = activeIndex >= 0 ? calculatedMonths[activeIndex] : calculatedMonths.find(m => m.isCurrent) || calculatedMonths[0];

  useEffect(() => {
    if (currentMonth && currentMonth.monthStr !== selectedMonthStr) {
      onSetSelectedMonthStr(currentMonth.monthStr);
    }
  }, [currentMonth, selectedMonthStr, onSetSelectedMonthStr]);

  // Income inline edit state
  const [isEditingIncome, setIsEditingIncome] = useState(false);
  const [incomeInput, setIncomeInput] = useState("");
  const [templatesExpanded, setTemplatesExpanded] = useState(true);

  // Table filter state
  const [filterType, setFilterType] = useState<"all" | "expense" | "income">("all");

  // Modal / Form state for Add/Edit Expense
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseItem & { originalAmount?: number; originalCurrency?: string; originalRate?: number } | null>(null);

  // Expense Form fields
  const [transactionType, setTransactionType] = useState<"expense" | "income">("expense");
  const [category, setCategory] = useState("Living");
  const [customCategory, setCustomCategory] = useState("");
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [description, setDescription] = useState("");
  const [completed, setCompleted] = useState(false);

  // Converter sub-state
  const [currency, setCurrency] = useState("USD");
  const [rawAmount, setRawAmount] = useState("");
  const [exchangeRate, setExchangeRate] = useState("1.0");

  // Keep track of category changes when switching transaction type in form
  useEffect(() => {
    if (!editingExpense) {
      if (transactionType === "income") {
        setCategory("Salary");
      } else {
        setCategory("Living");
      }
      setIsCustomCategory(false);
      setCustomCategory("");
    }
  }, [transactionType, editingExpense]);

  // Format currency for display
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(val);
  };

  // Switch month helpers
  const handlePrevMonth = () => {
    if (activeIndex > 0) {
      onSetSelectedMonthStr(calculatedMonths[activeIndex - 1].monthStr);
    }
  };

  const handleNextMonth = () => {
    if (activeIndex < calculatedMonths.length - 1) {
      onSetSelectedMonthStr(calculatedMonths[activeIndex + 1].monthStr);
    }
  };

  // Handle opening form for adding a new row
  const handleOpenAddForm = (type: "expense" | "income" = "expense") => {
    setEditingExpense(null);
    setTransactionType(type);
    setCategory(type === "income" ? "Salary" : "Living");
    setCustomCategory("");
    setIsCustomCategory(false);
    setDescription("");
    setCompleted(false);
    setCurrency("USD");
    setRawAmount("");
    setExchangeRate("1.0");
    setIsFormOpen(true);
  };

  const handleOpenTemplate = (template: ExpenseTemplate) => {
    setEditingExpense(null);
    setTransactionType("expense");
    if (EXPENSE_CATEGORIES.includes(template.category)) {
      setCategory(template.category);
      setCustomCategory("");
      setIsCustomCategory(false);
    } else {
      setCategory("Other");
      setCustomCategory(template.category);
      setIsCustomCategory(true);
    }
    setDescription(template.title);
    setCompleted(false);
    const templateCurrency = template.originalCurrency || "USD";
    setCurrency(templateCurrency);
    setRawAmount((template.originalAmount ?? template.amount)?.toString() ?? "");
    setExchangeRate((template.originalRate ?? DEFAULT_RATES[templateCurrency] ?? 1).toString());
    setIsFormOpen(true);
  };

  // Handle opening form for editing a row
  const handleOpenEditForm = (item: ExpenseItem & { originalAmount?: number; originalCurrency?: string; originalRate?: number }) => {
    setEditingExpense(item);
    const itemType = item.type || "expense";
    setTransactionType(itemType);

    const categoriesList = itemType === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    if (categoriesList.includes(item.category)) {
      setCategory(item.category);
      setIsCustomCategory(false);
    } else {
      setCategory("Other");
      setCustomCategory(item.category);
      setIsCustomCategory(true);
    }

    setDescription(item.description);
    setCompleted(item.completed);

    // Original currency state restore
    const originalCur = item.originalCurrency || "USD";
    setCurrency(originalCur);
    setRawAmount(item.originalAmount ? item.originalAmount.toString() : item.amount.toString());
    setExchangeRate(item.originalRate ? item.originalRate.toString() : (DEFAULT_RATES[originalCur] || 1).toString());

    setIsFormOpen(true);
  };

  // Update exchange rate automatically when currency changes
  useEffect(() => {
    if (!editingExpense || (editingExpense && editingExpense.originalCurrency !== currency)) {
      const defaultRate = DEFAULT_RATES[currency] || 1.0;
      setExchangeRate(defaultRate.toString());
    }
  }, [currency, editingExpense]);

  // Calculate equivalent USD for preview
  const parsedRawAmount = parseFloat(rawAmount);
  const parsedRate = parseFloat(exchangeRate);
  const calculatedUsdAmount = currency === "USD"
    ? (Number.isFinite(parsedRawAmount) ? parsedRawAmount : 0)
    : Number.isFinite(parsedRawAmount) && Number.isFinite(parsedRate) && parsedRate > 0
      ? Number((parsedRawAmount / parsedRate).toFixed(2))
      : 0;

  // Handle Form Submit
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      triggerAlert("Check your entries", "Add a transaction description.");
      return;
    }
    if (!Number.isFinite(parsedRawAmount) || parsedRawAmount <= 0) {
      triggerAlert("Check your entries", "The amount must be greater than zero.");
      return;
    }
    if (currency !== "USD" && (!Number.isFinite(parsedRate) || parsedRate <= 0)) {
      triggerAlert("Check your entries", "The exchange rate must be greater than zero.");
      return;
    }

    const finalCategory = isCustomCategory ? customCategory.trim() : category;
    if (!finalCategory) {
      triggerAlert("Check your entries", "Select or enter a category.");
      return;
    }

    const payload = {
      category: finalCategory,
      description: description.trim(),
      amount: calculatedUsdAmount,
      completed,
      type: transactionType,
      originalAmount: parsedRawAmount,
      originalCurrency: currency,
      originalRate: parsedRate
    };

    if (editingExpense) {
      onEditExpense(selectedMonthStr, {
        ...payload,
        id: editingExpense.id
      });
    } else {
      onAddExpense(selectedMonthStr, payload);
    }

    setIsFormOpen(false);
  };

  // Quick toggle completed status
  const handleToggleStatus = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleExpenseCompleted(selectedMonthStr, id);
  };

  // Handle inline income saving
  const handleSaveIncome = () => {
    const val = parseFloat(incomeInput);
    if (!isNaN(val) && val >= 0) {
      onUpdateMonthIncome(selectedMonthStr, val);
      setIsEditingIncome(false);
    } else {
      triggerAlert("Invalid amount", "Enter an income amount of zero or greater.");
    }
  };

  // When selected month changes, cancel active state editors
  useEffect(() => {
    setIsEditingIncome(false);
    if (currentMonth) {
      setIncomeInput(currentMonth.baseIncome !== undefined ? currentMonth.baseIncome.toString() : currentMonth.income.toString());
    }
  }, [selectedMonthStr, currentMonth?.monthStr, currentMonth?.baseIncome]);

  useEffect(() => {
    if (!isFormOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsFormOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isFormOpen]);

  if (!currentMonth) return null;

  // Filter items in the list based on selection
  const filteredItems = currentMonth.expenses.filter((item) => {
    const itemType = item.type || "expense";
    if (filterType === "all") return true;
    return itemType === filterType;
  });

  // Split filteredItems into distinct lists for clean split section rendering
  const incomeItems = filteredItems.filter(item => item.type === "income");
  const toSpendItems = filteredItems.filter(item => item.type !== "income" && !item.completed);
  const spentItems = filteredItems.filter(item => item.type !== "income" && item.completed);

  // Calculate stats for current view
  const activeCategories = transactionType === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  // Let's compute local totals for itemized entries
  const localIncomesTotal = currentMonth.expenses.filter(e => e.type === "income").reduce((sum, e) => sum + e.amount, 0);
  const localExpensesTotal = currentMonth.expenses.filter(e => e.type !== "income").reduce((sum, e) => sum + e.amount, 0);

  // Compute progress of paid expenses
  const expensePercentage = currentMonth.totalExpenses > 0
    ? Math.min(Math.round((currentMonth.completedExpenses / currentMonth.totalExpenses) * 100), 100)
    : 0;

  return (
    <div className="figma-budget space-y-6">

      {/* TWO BLOCK LAYOUT: 1. Left (Selector + Compact KPIs) | 2. Right (Transactions Table) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* Left Column (Selector + KPIs) - Spans 4 columns on large screens */}
        <div className="budget-overview lg:col-span-5 xl:col-span-4 space-y-6">

          {/* 1. COMPACT HORIZONTAL MONTH PILLS */}
          <div className="budget-months liquid-glass p-4 rounded-3xl space-y-3">
            <div className="budget-months-meta flex items-center justify-between">
              <span className="text-[9px] font-bold text-white/40 tracking-wider uppercase font-mono flex items-center gap-1.5">
                <Calendar size={11} className="text-emerald-400" /> Period
              </span>
              {calculatedMonths.length > 1 && onDeleteMonth && (
                <button
                  onClick={() => onDeleteMonth(selectedMonthStr)}
                  className="text-[9px] font-bold text-rose-400 hover:text-rose-300 transition-all flex items-center gap-1 px-2.5 py-0.5 bg-rose-500/10 hover:bg-rose-500/20 rounded-full border border-rose-500/10 hover:border-rose-500/20 cursor-pointer active:scale-95"
                >
                  <Trash2 size={9} strokeWidth={2.5} />
                  Delete
                </button>
              )}
            </div>

            <div className="flex items-stretch gap-2">
              <div className="budget-months-scroll min-w-0 flex-1 overflow-x-auto scrollbar-none flex gap-1.5 pb-1 scroll-smooth snap-x">
                {calculatedMonths.map((m) => {
                  const isActive = m.monthStr === selectedMonthStr;
                  return (
                    <button
                      key={m.monthStr}
                      onClick={() => onSetSelectedMonthStr(m.monthStr)}
                      className={`budget-month-pill snap-start shrink-0 px-3.5 py-2 rounded-2xl text-[11px] font-bold transition-all duration-300 cursor-pointer border flex items-center gap-1.5 ${
                        isActive
                          ? "bg-emerald-500 text-slate-950 border-emerald-400/30 shadow-[0_4px_12px_rgba(16,185,129,0.25)] scale-[1.01]"
                          : "bg-white/[0.02] text-white/50 hover:text-white hover:bg-white/[0.05] border-white/[0.04] hover:border-white/[0.1]"
                      }`}
                    >
                      <span>{m.monthName} '{m.monthYear.slice(2)}</span>
                    </button>
                  );
                })}
              </div>
              {onAddMonth && (
                <button
                  onClick={onAddMonth}
                  className="shrink-0 px-3 py-2 rounded-2xl text-[11px] font-bold bg-emerald-500/10 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/30 transition-all duration-300 flex items-center justify-center gap-1 cursor-pointer active:scale-95"
                  aria-label="Add next month"
                >
                  <Plus size={14} strokeWidth={3} />
                  <span className="hidden sm:inline">Add</span>
                </button>
              )}
            </div>
          </div>

          {/* 2. DYNAMIC BUDGET KPIS (Income, Planned Spend, Spent with progress bar, Leftover) */}
          <div className="budget-kpi-grid grid grid-cols-2 gap-4">

            {/* KPI 1: Income */}
            <div className="budget-kpi budget-kpi-income liquid-glass rounded-3xl p-4 relative overflow-hidden flex flex-col justify-between group hover:border-emerald-500/30 transition-all duration-300 col-span-1">
              <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-16 h-16 bg-emerald-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-emerald-500/10 transition-all duration-300" />

              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-bold text-white/40 tracking-wider uppercase">Income</span>
                <div className="budget-kpi-icon p-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg">
                  <ArrowUpRight size={12} strokeWidth={2.5} />
                </div>
              </div>

              <div className="space-y-1 mt-1">
                {isEditingIncome ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={incomeInput}
                      onChange={(e) => setIncomeInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveIncome();
                        if (e.key === "Escape") setIsEditingIncome(false);
                      }}
                      min="0"
                      step="0.01"
                      className="w-full bg-slate-950/80 border border-white/[0.15] text-xs font-mono rounded-lg px-2 py-1 text-white outline-none focus:border-emerald-500/50 transition-all"
                      autoFocus
                    />
                    <button
                      onClick={handleSaveIncome}
                      className="p-1.5 bg-emerald-500 text-slate-950 rounded-lg font-bold text-[10px] hover:bg-emerald-400 transition cursor-pointer flex items-center justify-center shrink-0"
                    >
                      <Check size={11} strokeWidth={3} />
                    </button>
                    <button
                      onClick={() => {
                        setIsEditingIncome(false);
                        setIncomeInput(currentMonth.baseIncome !== undefined ? currentMonth.baseIncome.toString() : currentMonth.income.toString());
                      }}
                      className="p-1.5 bg-white/[0.05] border border-white/[0.1] text-white/60 hover:text-white rounded-lg text-[10px] transition cursor-pointer flex items-center justify-center shrink-0"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-baseline justify-between group/edit">
                    <h3 className="text-lg font-black text-white tracking-tight font-sans">
                      {formatCurrency(currentMonth.income)}
                    </h3>
                    <button
                      onClick={() => setIsEditingIncome(true)}
                      className="p-0.5 text-white/30 hover:text-emerald-400 rounded transition duration-150 opacity-0 group-hover/edit:opacity-100 sm:opacity-100 cursor-pointer"
                      aria-label="Edit baseline income"
                    >
                      <Edit3 size={11} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* KPI 2: Planned Spend */}
            <div className="budget-kpi budget-kpi-planned liquid-glass rounded-3xl p-4 relative overflow-hidden flex flex-col justify-between group hover:border-rose-500/30 transition-all duration-300 col-span-1">
              <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-16 h-16 bg-rose-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-rose-500/10 transition-all duration-300" />

              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-bold text-white/40 tracking-wider uppercase">Planned Spend</span>
                <div className="budget-kpi-icon p-1.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg">
                  <Coins size={12} strokeWidth={2.2} />
                </div>
              </div>

              <div className="space-y-1 mt-1">
                <h3 className="text-lg font-black text-white tracking-tight font-sans">
                  {formatCurrency(currentMonth.totalExpenses)}
                </h3>
              </div>
            </div>

            {/* KPI 3: Spent */}
            <div className="budget-kpi budget-kpi-paid liquid-glass rounded-3xl p-4 relative overflow-hidden flex flex-col justify-between group hover:border-emerald-500/30 transition-all duration-300 col-span-1">
              <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-16 h-16 bg-emerald-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-emerald-500/10 transition-all duration-300" />

              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-bold text-white/40 tracking-wider uppercase">Paid</span>
                <div className="budget-kpi-icon p-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg">
                  <CheckCircle2 size={12} strokeWidth={2.2} />
                </div>
              </div>

              <div className="space-y-2 mt-1">
                <h3 className="text-lg font-black text-white tracking-tight font-sans">
                  {formatCurrency(currentMonth.completedExpenses)}
                </h3>

                {/* Embedded Progress Bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[7px] text-white/30 font-medium">
                    <span>Completed {expensePercentage}%</span>
                  </div>
                  <div className="w-full h-1 bg-white/[0.05] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                      style={{ width: `${expensePercentage}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* KPI 4: Leftover */}
            <div className="budget-kpi budget-kpi-leftover liquid-glass rounded-3xl p-4 relative overflow-hidden flex flex-col justify-between group hover:border-emerald-500/30 transition-all duration-300 col-span-1">
              <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-16 h-16 bg-emerald-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-emerald-500/10 transition-all duration-300" />

              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-bold text-white/40 tracking-wider uppercase">Leftover</span>
                <div className={`budget-kpi-icon p-1.5 rounded-lg border ${currentMonth.net >= 0 ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-rose-500/10 border-rose-500/20 text-rose-400"}`}>
                  {currentMonth.net >= 0 ? <TrendingUp size={12} strokeWidth={2.2} /> : <TrendingDown size={12} strokeWidth={2.2} />}
                </div>
              </div>

              <div className="space-y-1 mt-1">
                <h3 className={`text-lg font-black tracking-tight font-sans ${currentMonth.net >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {currentMonth.net >= 0 ? "+" : ""}{formatCurrency(currentMonth.net)}
                </h3>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column (Transactions) - Spans 8 columns on large screens */}
        <div className="budget-transactions lg:col-span-7 xl:col-span-8">

          <div className="space-y-5">

            {/* Filter controls */}
            <div className="budget-actions liquid-glass rounded-[2rem] p-3.5 space-y-3">

              {/* Segmented Filter Tab */}
              <div className="budget-filter-tabs transaction-tabs flex bg-slate-950/80 p-1 border border-white/[0.06] w-full" role="tablist" aria-label="Transaction filter">
                <button
                  onClick={() => setFilterType("all")}
                  aria-pressed={filterType === "all"}
                  className={`transaction-tab min-w-0 px-2.5 py-2 text-[11px] font-semibold transition-all duration-150 flex-1 cursor-pointer text-center ${
                    filterType === "all"
                      ? "bg-white/[0.06] text-white shadow"
                      : "text-white/40 hover:text-white"
                  }`}
                >
                  <span className="sm:hidden">All</span>
                  <span className="hidden sm:inline">All Transactions</span>
                </button>
                <button
                  onClick={() => setFilterType("expense")}
                  aria-pressed={filterType === "expense"}
                  className={`transaction-tab min-w-0 px-2.5 py-2 text-[11px] font-semibold transition-all duration-150 flex-1 cursor-pointer text-center flex items-center justify-center gap-1.5 ${
                    filterType === "expense"
                      ? "bg-rose-500/10 text-rose-300 border border-rose-500/20"
                      : "text-white/40 hover:text-white"
                  }`}
                >
                  <span className="w-1.5 h-1.5 bg-rose-500 rounded-full" />
                  Expenses
                </button>
                <button
                  onClick={() => setFilterType("income")}
                  aria-pressed={filterType === "income"}
                  className={`transaction-tab min-w-0 px-2.5 py-2 text-[11px] font-semibold transition-all duration-150 flex-1 cursor-pointer text-center flex items-center justify-center gap-1.5 ${
                    filterType === "income"
                      ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                      : "text-white/40 hover:text-white"
                  }`}
                >
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                  Income
                </button>
              </div>

              {/* Add transaction controls */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleOpenAddForm("expense")}
                  className="mobile-primary-action flex min-w-0 items-center justify-center gap-2 px-3 py-3 bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/20 hover:border-rose-500/30 text-rose-300 hover:text-rose-200 text-xs font-bold tracking-wide transition-all duration-200 cursor-pointer active:scale-95"
                >
                  <Plus size={16} strokeWidth={2.5} />
                  <span className="truncate">Add Expense</span>
                </button>

                <button
                  onClick={() => handleOpenAddForm("income")}
                  className="mobile-primary-action flex min-w-0 items-center justify-center gap-2 px-3 py-3 bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20 hover:border-emerald-500/30 text-emerald-300 hover:text-emerald-200 text-xs font-bold tracking-wide transition-all duration-200 cursor-pointer active:scale-95"
                >
                  <Plus size={16} strokeWidth={2.5} />
                  <span className="truncate">Add Income</span>
                </button>
              </div>
            </div>

            {expenseTemplates.length > 0 && (
              <section className="budget-templates space-y-2" aria-label="Expense templates">
                <button
                  type="button"
                  onClick={() => setTemplatesExpanded(value => !value)}
                  aria-expanded={templatesExpanded}
                  className="budget-templates-toggle flex min-h-11 w-full items-center justify-between rounded-full border border-white/[0.08] bg-white/[0.025] px-4 text-left transition hover:bg-white/[0.05]"
                >
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/55">Templates</span>
                  <span className="flex items-center gap-2 text-[9px] font-bold text-white/30">
                    {expenseTemplates.length}
                    <ChevronDown size={14} className={`transition-transform duration-200 ${templatesExpanded ? "rotate-180" : ""}`} />
                  </span>
                </button>
                {templatesExpanded && <div className="budget-template-list scrollbar-none flex gap-2 overflow-x-auto pb-1">
                  {expenseTemplates.map(template => {
                    const alreadyAdded = template.source === "recurring" && currentMonth.expenses.some(item =>
                      item.type !== "income" && normalizeTemplateTitle(item.description) === normalizeTemplateTitle(template.title)
                    );

                    return (
                      <button
                        key={template.id}
                        onClick={() => handleOpenTemplate(template)}
                        disabled={alreadyAdded}
                        className={`budget-template-chip liquid-glass flex min-h-14 min-w-[9.5rem] shrink-0 items-center justify-between gap-3 px-4 py-2.5 text-left transition-all ${
                          alreadyAdded
                            ? "cursor-default opacity-45"
                            : template.source === "debt"
                              ? "border-rose-500/15 bg-rose-500/[0.05] hover:border-rose-400/30"
                              : "border-cyan-400/15 bg-cyan-500/[0.04] hover:border-cyan-300/30"
                        }`}
                      >
                        <span className="block max-w-32 truncate text-[11px] font-medium text-white/90">{template.title}</span>
                        {alreadyAdded ? (
                          <Check size={14} className="shrink-0 text-emerald-400" />
                        ) : template.amount !== undefined ? (
                          <span className="shrink-0 text-[10px] font-black text-white/60">{formatCurrency(template.amount)}</span>
                        ) : (
                          <Plus size={14} className="shrink-0 text-white/35" />
                        )}
                      </button>
                    );
                  })}
                </div>}
              </section>
            )}

            {/* Transactions remain on the page instead of inside a nested scroll container. */}
            <div className="transaction-list space-y-6">
              {filteredItems.length === 0 ? (
                <div className="liquid-glass rounded-[2rem] py-12 text-center px-4">
                  <div className="w-10 h-10 rounded-2xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-center mx-auto mb-2 text-white/30">
                    <HelpCircle size={18} />
                  </div>
                  <p className="text-xs text-white/40 font-bold tracking-wide">No transactions yet</p>
                </div>
              ) : (
                <>
                  {/* 1. INCOME GROUP */}
                  {incomeItems.length > 0 && (
                    <div className="space-y-2">
                      <div className="budget-group-heading px-1 flex items-center justify-between">
                        <span className="text-[9px] uppercase font-black tracking-widest text-emerald-400 font-mono">Income Received</span>
                        <span className="text-[9px] font-mono font-bold text-white/30">+{formatCurrency(incomeItems.reduce((sum, item) => sum + item.amount, 0))}</span>
                      </div>
                      <div className="space-y-2">
                        {incomeItems.map((item) => {
                          return (
                            <div
                              key={item.id}
                              className="budget-row budget-row-income liquid-glass flex items-center justify-between rounded-[1.65rem] p-3.5 sm:p-4 transition-all duration-150 group hover:border-emerald-500/15"
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                {/* Checkbox with custom padding for easy click */}
                                <button
                                  onClick={(e) => handleToggleStatus(item.id, e)}
                                  className="transaction-check-button p-1 -m-1 cursor-pointer outline-none shrink-0"
                                  aria-label={item.completed ? "Mark as not received" : "Mark as received"}
                                >
                                  <div
                                    className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all duration-200 ${
                                      item.completed
                                        ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.2)]"
                                        : "border-white/20 bg-white/5 hover:border-emerald-500 hover:bg-emerald-500/10 text-transparent"
                                    }`}
                                  >
                                    <Check size={11} className={item.completed ? "scale-100 opacity-100" : "scale-50 opacity-0"} strokeWidth={3} />
                                  </div>
                                </button>

                                {/* Title & Category Stacked */}
                                <div
                                  className="min-w-0 flex-1 cursor-pointer"
                                  onClick={() => handleOpenEditForm(item)}
                                >
                                  <p className="text-[13px] font-bold text-white/90 truncate">
                                    {item.description || item.category}
                                  </p>
                                  {item.description && (
                                    <span className="budget-row-category inline-flex max-w-[160px] sm:max-w-xs truncate mt-1 rounded-lg border border-emerald-500/15 bg-emerald-500/[0.08] px-2 py-0.5 text-[9px] font-semibold text-emerald-300/70">
                                      {item.category}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Amount and inline action buttons */}
                              <div className="flex items-center gap-3 shrink-0 pl-2">
                                <div
                                  className="text-right cursor-pointer"
                                  onClick={() => handleOpenEditForm(item)}
                                >
                                  <p className="text-[12px] font-bold font-mono tracking-tight text-emerald-400">
                                    +{formatCurrency(item.amount)}
                                  </p>
                                  {item.originalCurrency && item.originalCurrency !== "USD" && item.originalAmount && (
                                    <p className="text-[8px] text-white/20 font-sans mt-0.5 font-medium">
                                      {item.originalAmount.toLocaleString()} {CURRENCY_SYMBOLS[item.originalCurrency]}
                                    </p>
                                  )}
                                </div>

                                <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenEditForm(item);
                                    }}
                                    className="transaction-row-action p-1 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/[0.12] text-white/40 hover:text-white rounded-md transition-all cursor-pointer"
                                    aria-label="Edit"
                                  >
                                    <Edit3 size={11} />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      triggerConfirm(
                                        "Delete transaction",
                                        `Delete “${item.description || item.category}”?`,
                                        () => onDeleteExpense(selectedMonthStr, item.id)
                                      );
                                    }}
                                    className="transaction-row-action p-1 bg-rose-500/5 hover:bg-rose-500/20 border border-rose-500/10 text-rose-400 hover:text-rose-300 rounded-md transition-all cursor-pointer"
                                    aria-label="Delete"
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 2. TO SPEND GROUP */}
                  {filterType !== "income" && toSpendItems.length > 0 && (
                    <div className="space-y-2">
                      <div className="budget-group-heading px-1 flex items-center justify-between">
                        <span className="text-[9px] uppercase font-black tracking-widest text-rose-400 font-mono">To Pay</span>
                        <span className="text-[9px] font-mono font-bold text-white/30">-{formatCurrency(toSpendItems.reduce((sum, item) => sum + item.amount, 0))}</span>
                      </div>
                      <div className="space-y-2">
                        {toSpendItems.map((item) => {
                            return (
                              <div
                                key={item.id}
                                className="budget-row budget-row-expense liquid-glass flex items-center justify-between rounded-[1.65rem] p-3.5 sm:p-4 transition-all duration-150 group hover:border-rose-500/15"
                              >
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                  {/* Checkbox */}
                                  <button
                                    onClick={(e) => handleToggleStatus(item.id, e)}
                                    className="transaction-check-button p-1 -m-1 cursor-pointer outline-none shrink-0"
                                    aria-label="Mark as paid"
                                  >
                                    <div
                                      className="w-5 h-5 rounded-md border flex items-center justify-center transition-all duration-200 border-white/20 bg-white/5 hover:border-emerald-500 hover:bg-emerald-500/10 text-transparent"
                                    >
                                      <Check size={11} className="scale-50 opacity-0" strokeWidth={3} />
                                    </div>
                                  </button>

                                  {/* Title & Category Stacked */}
                                  <div
                                    className="min-w-0 flex-1 cursor-pointer"
                                    onClick={() => handleOpenEditForm(item)}
                                  >
                                    <p className="text-[13px] font-bold text-white/90 truncate">
                                      {item.description || item.category}
                                    </p>
                                    {item.description && (
                                      <span className="budget-row-category inline-flex max-w-[160px] sm:max-w-xs truncate mt-1 rounded-lg border border-rose-500/15 bg-rose-500/[0.08] px-2 py-0.5 text-[9px] font-semibold text-rose-300/70">
                                        {item.category}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Amount and inline action buttons */}
                                <div className="flex items-center gap-3 shrink-0 pl-2">
                                  <div
                                    className="text-right cursor-pointer"
                                    onClick={() => handleOpenEditForm(item)}
                                  >
                                    <p className="text-[12px] font-bold font-mono tracking-tight text-white/90">
                                      {formatCurrency(item.amount)}
                                    </p>
                                    {item.originalCurrency && item.originalCurrency !== "USD" && item.originalAmount && (
                                      <p className="text-[8px] text-white/20 font-sans mt-0.5 font-medium">
                                        {item.originalAmount.toLocaleString()} {CURRENCY_SYMBOLS[item.originalCurrency]}
                                      </p>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenEditForm(item);
                                      }}
                                      className="transaction-row-action p-1 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/[0.12] text-white/40 hover:text-white rounded-md transition-all cursor-pointer"
                                      aria-label="Edit"
                                    >
                                      <Edit3 size={11} />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        triggerConfirm(
                                          "Delete transaction",
                                          `Delete “${item.description || item.category}”?`,
                                          () => onDeleteExpense(selectedMonthStr, item.id)
                                        );
                                      }}
                                      className="transaction-row-action p-1 bg-rose-500/5 hover:bg-rose-500/20 border border-rose-500/10 text-rose-400 hover:text-rose-300 rounded-md transition-all cursor-pointer"
                                      aria-label="Delete"
                                    >
                                      <Trash2 size={11} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}

                  {/* 3. SPENT GROUP */}
                  {filterType !== "income" && spentItems.length > 0 && (
                    <div className="space-y-2">
                      <div className="budget-group-heading px-1 flex items-center justify-between">
                        <span className="text-[9px] uppercase font-black tracking-widest text-emerald-400 font-mono">Paid</span>
                        <span className="text-[9px] font-mono font-bold text-white/30">-{formatCurrency(spentItems.reduce((sum, item) => sum + item.amount, 0))}</span>
                      </div>
                      <div className="space-y-2">
                        {spentItems.map((item) => {
                            return (
                              <div
                                key={item.id}
                                className="budget-row budget-row-completed liquid-glass flex items-center justify-between rounded-[1.65rem] p-3.5 sm:p-4 transition-all duration-150 group opacity-60 hover:border-emerald-500/15"
                              >
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                  {/* Checkbox */}
                                  <button
                                    onClick={(e) => handleToggleStatus(item.id, e)}
                                    className="transaction-check-button p-1 -m-1 cursor-pointer outline-none shrink-0"
                                    aria-label="Mark as unpaid"
                                  >
                                    <div
                                      className="w-5 h-5 rounded-md border flex items-center justify-center transition-all duration-200 bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.2)]"
                                    >
                                      <Check size={11} className="scale-100 opacity-100" strokeWidth={3} />
                                    </div>
                                  </button>

                                  {/* Title & Category Stacked */}
                                  <div
                                    className="min-w-0 flex-1 cursor-pointer"
                                    onClick={() => handleOpenEditForm(item)}
                                  >
                                    <p className="text-[13px] font-bold text-white/50 line-through truncate">
                                      {item.description || item.category}
                                    </p>
                                    {item.description && (
                                      <span className="budget-row-category inline-flex max-w-[160px] sm:max-w-xs truncate mt-1 rounded-lg border border-rose-500/10 bg-rose-500/[0.06] px-2 py-0.5 text-[9px] font-semibold text-rose-300/40 line-through">
                                        {item.category}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Amount and inline action buttons */}
                                <div className="flex items-center gap-3 shrink-0 pl-2">
                                  <div
                                    className="text-right cursor-pointer"
                                    onClick={() => handleOpenEditForm(item)}
                                  >
                                    <p className="text-[12px] font-normal font-mono text-white/40 line-through">
                                      {formatCurrency(item.amount)}
                                    </p>
                                    {item.originalCurrency && item.originalCurrency !== "USD" && item.originalAmount && (
                                      <p className="text-[8px] text-white/10 font-sans mt-0.5 font-medium">
                                        {item.originalAmount.toLocaleString()} {CURRENCY_SYMBOLS[item.originalCurrency]}
                                      </p>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenEditForm(item);
                                      }}
                                      className="transaction-row-action p-1 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/[0.12] text-white/40 hover:text-white rounded-md transition-all cursor-pointer"
                                      aria-label="Edit"
                                    >
                                      <Edit3 size={11} />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        triggerConfirm(
                                          "Delete transaction",
                                          `Delete “${item.description || item.category}”?`,
                                          () => onDeleteExpense(selectedMonthStr, item.id)
                                        );
                                      }}
                                      className="transaction-row-action p-1 bg-rose-500/5 hover:bg-rose-500/20 border border-rose-500/10 text-rose-400 hover:text-rose-300 rounded-md transition-all cursor-pointer"
                                      aria-label="Delete"
                                    >
                                      <Trash2 size={11} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* 4. MODAL/POPUP DIALOG (Extremely gorgeous, glassmorphic card with sliding type controllers and editable converter) */}
      {isFormOpen && (
        <div
          className="app-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fadeIn"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsFormOpen(false);
          }}
          role="presentation"
        >
          <div className="liquid-glass-strong rounded-[28px] w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto relative animate-scaleUp" role="dialog" aria-modal="true" aria-label={editingExpense ? "Edit transaction" : "New transaction"}>

            {/* Modal header */}
            <div className="px-6 py-5 border-b border-white/[0.06] flex items-center justify-between bg-black/30">
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <Sparkles size={16} className={transactionType === "income" ? "text-emerald-400" : "text-rose-400"} />
                {editingExpense ? "Edit Transaction" : "New Transaction"}
              </h3>
              <button
                onClick={() => setIsFormOpen(false)}
                className="p-1.5 text-white/40 hover:text-white hover:bg-white/[0.04] rounded-xl transition duration-150 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-5">

              {/* Type Switcher Segmented Control */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest font-mono">Transaction Type</label>
                <div className="grid grid-cols-2 bg-black/40 p-1 rounded-2xl border border-white/[0.04]">
                  <button
                    type="button"
                    onClick={() => {
                      setTransactionType("expense");
                      setCategory("Living");
                      setIsCustomCategory(false);
                    }}
                    className={`py-2 text-xs font-bold rounded-xl transition-all duration-200 cursor-pointer text-center ${
                      transactionType === "expense"
                        ? "bg-rose-500/15 text-rose-300 border border-rose-500/20"
                        : "text-white/40 hover:text-white"
                    }`}
                  >
                    Expense
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTransactionType("income");
                      setCategory("Salary");
                      setIsCustomCategory(false);
                    }}
                    className={`py-2 text-xs font-bold rounded-xl transition-all duration-200 cursor-pointer text-center ${
                      transactionType === "income"
                        ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20"
                        : "text-white/40 hover:text-white"
                    }`}
                  >
                    Income
                  </button>
                </div>
              </div>

              {/* Category selector */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest font-mono">Category</label>

                {isCustomCategory ? (
                  <div className="flex gap-2 animate-fadeIn">
                    <input
                      type="text"
                      required
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      className="flex-1 bg-black/40 border border-white/[0.08] focus:border-emerald-500/50 rounded-2xl px-4 py-2.5 text-xs text-white outline-none focus:ring-0 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomCategory(false);
                        setCategory(transactionType === "income" ? "Salary" : "Living");
                      }}
                      className="px-3 bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.08] text-white/60 text-[10px] font-bold uppercase tracking-wider rounded-2xl cursor-pointer"
                    >
                      List
                    </button>
                  </div>
                ) : (
                  <select
                    value={category}
                    onChange={(e) => {
                      if (e.target.value === "Other") {
                        setIsCustomCategory(true);
                        setCustomCategory("");
                      } else {
                        setCategory(e.target.value);
                      }
                    }}
                    className="w-full bg-black/40 border border-white/[0.08] focus:border-emerald-500/50 rounded-2xl px-4 py-2.5 text-xs text-white/80 outline-none cursor-pointer transition-all focus:ring-0"
                  >
                    {activeCategories.map(cat => (
                      <option key={cat} value={cat} className="bg-slate-950 text-slate-100">{cat}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Title Input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest font-mono">Title *</label>
                <input
                  type="text"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-black/40 border border-white/[0.08] focus:border-emerald-500/50 rounded-2xl px-4 py-3 text-xs text-white outline-none focus:ring-0 transition-all placeholder-white/20"
                />
              </div>

              {/* CURRENCY CONVERTER SECTION (Pristine visual component) */}
              <div className="bg-white/[0.01] border border-white/[0.06] p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest font-mono flex items-center gap-1">
                    Currency Converter
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400 font-bold">⇒ USD ($)</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Currency Select */}
                  <div className="space-y-1">
                    <label className="text-[8px] text-white/40 font-bold uppercase tracking-wider">Currency</label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full bg-black/45 border border-white/[0.08] rounded-xl px-2.5 py-2 text-xs text-white outline-none cursor-pointer font-mono focus:ring-0"
                    >
                      <option value="USD" className="bg-slate-950 text-slate-100">USD ($) — US Dollar</option>
                      <option value="RUB" className="bg-slate-950 text-slate-100">RUB (₽) — Russian Ruble</option>
                      <option value="GEL" className="bg-slate-950 text-slate-100">GEL (₾) — Georgian Lari</option>
                      <option value="EUR" className="bg-slate-950 text-slate-100">EUR (€) — Euro</option>
                      <option value="KZT" className="bg-slate-950 text-slate-100">KZT (₸) — Kazakhstani Tenge</option>
                    </select>
                  </div>

                  {/* Amount in Selected Currency */}
                  <div className="space-y-1">
                    <label className="text-[8px] text-white/40 font-bold uppercase tracking-wider">Amount ({CURRENCY_SYMBOLS[currency]})</label>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      required
                      value={rawAmount}
                      onChange={(e) => setRawAmount(e.target.value)}
                      className="w-full bg-black/45 border border-white/[0.08] rounded-xl px-2.5 py-2 text-xs text-white font-mono outline-none focus:border-emerald-500/30 focus:ring-0 transition-all placeholder-white/20"
                    />
                  </div>
                </div>

                {/* Exchange Rate */}
                {currency !== "USD" && (
                  <div className="grid grid-cols-2 gap-3 pt-1 animate-fadeIn">
                    <div className="flex items-center gap-1 text-[9px] text-white/30 font-medium">
                      <span>Rate:</span>
                      <span className="font-mono text-white/40">1 USD =</span>
                    </div>

                    <div className="flex items-center gap-1 bg-black/40 border border-white/[0.08] rounded-xl px-2.5 py-1">
                      <input
                        type="number"
                        step="any"
                        min="0.000001"
                        required
                        value={exchangeRate}
                        onChange={(e) => setExchangeRate(e.target.value)}
                        className="w-full bg-transparent text-right text-xs font-mono text-white outline-none"
                      />
                      <span className="text-[10px] text-white/30 font-mono pr-0.5">{currency}</span>
                    </div>
                  </div>
                )}

                {/* Conversion Preview Calculator */}
                {rawAmount && (
                  <div className="bg-black/35 rounded-xl p-3 text-[11px] text-white/40 font-mono flex items-center justify-between border border-white/[0.02]">
                    <span>Equivalent in USD:</span>
                    <span className="text-emerald-400 font-bold text-xs">
                      {formatCurrency(calculatedUsdAmount)}
                    </span>
                  </div>
                )}
              </div>

              {/* Status input */}
              <div className="flex items-center gap-2.5 pt-1">
                <input
                  type="checkbox"
                  id="modal-completed"
                  checked={completed}
                  onChange={(e) => setCompleted(e.target.checked)}
                  className="w-4.5 h-4.5 rounded-lg border-white/10 bg-black/40 text-emerald-500 focus:ring-0 focus:ring-offset-0 cursor-pointer transition-all"
                />
                <label htmlFor="modal-completed" className="text-xs text-white/60 select-none cursor-pointer hover:text-white/80 transition-colors">
                  {transactionType === "income" ? "Income received" : "Expense paid"}
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2.5 pt-4 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-5 py-2.5 text-xs font-bold hover:bg-white/[0.03] border border-transparent hover:border-white/[0.08] text-white/60 hover:text-white rounded-2xl transition duration-150 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold bg-white/[0.08] hover:bg-white/[0.12] border border-white/[0.1] text-white rounded-2xl transition duration-150 cursor-pointer active:scale-95"
                >
                  {editingExpense ? "Save" : "Add"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
