import { useState, useEffect, useMemo, useRef } from "react";
import { FinanceData, ExpenseItem, DebtItem, ExpenseTemplate, ExpenseTemplateOverride } from "./types";
import { calculateMonthlyStats, CalculatedMonth } from "./utils/calculations";
import { buildExpenseTemplates } from "./utils/expenseTemplates";
import { DashboardView } from "./components/DashboardView";
import { FutureView } from "./components/FutureView";
import { SettingsView } from "./components/SettingsView";
import { TemplateSettingsView } from "./components/TemplateSettingsView";
import { DebtView } from "./components/DebtView";
import { ConfirmModal } from "./components/ConfirmModal";
import { FigmaIcon } from "./components/FigmaIcon";
import { apiFetch } from "./api";
import {
  Wallet,
  Calendar,
  Settings,
  RefreshCw,
  WifiOff,
  Database,
  HandCoins,
  PartyPopper,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// Generate ID helper
const generateId = () => crypto.randomUUID();

// Get current month YYYY-MM helper
const getCurrentMonthStr = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const normalizeDebtTitle = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase();

const syncDebtPayments = (debts: DebtItem[], monthlyBudgets: FinanceData["monthlyBudgets"]): DebtItem[] => {
  const completedDebtExpenses = monthlyBudgets
    .flatMap(budget => budget.expenses
      .filter(expense =>
        expense.type !== "income" &&
        expense.completed &&
        normalizeDebtTitle(expense.category) === "debt"
      )
      .map(expense => ({ expense, monthStr: budget.monthStr })))
    .sort((a, b) => a.monthStr.localeCompare(b.monthStr) || a.expense.id.localeCompare(b.expense.id));

  return debts.map(debt => {
    let paid = 0;
    const linkedPayments = [] as DebtItem["payments"];

    for (const { expense, monthStr } of completedDebtExpenses) {
      if (normalizeDebtTitle(expense.description) !== normalizeDebtTitle(debt.name)) continue;
      const remaining = Number(Math.max(debt.totalAmount - paid, 0).toFixed(2));
      if (remaining <= 0) break;
      const amount = Math.min(expense.amount, remaining);
      linkedPayments.push({
        id: `expense:${monthStr}:${expense.id}`,
        amount,
        createdAt: `${monthStr}-01T00:00:00.000Z`,
        sourceExpenseId: expense.id,
        sourceMonthStr: monthStr,
      });
      paid += amount;
    }

    return { ...debt, payments: linkedPayments };
  });
};

export default function App() {
  // Navigation State
  const [activeTab, setActiveTab] = useState<string>("budget");

  // Finance State
  const [data, setData] = useState<FinanceData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'pending' | 'offline'>('syncing');
  const [storagePersistent, setStoragePersistent] = useState<boolean | null>(null);
  const [storageProvider, setStorageProvider] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const saveVersionRef = useRef(0);
  const lastPersistedDataRef = useRef<string | null>(null);
  const previousClosedDebtIdsRef = useRef<Set<string> | null>(null);
  const celebrationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debtCelebration, setDebtCelebration] = useState<string | null>(null);

  // Month Selection State
  const [selectedMonthStr, setSelectedMonthStr] = useState<string>(getCurrentMonthStr());

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [activeTab]);

  useEffect(() => {
    if (!data) return;
    const closedDebts = (data.debts ?? []).filter(debt =>
      debt.payments.reduce((sum, payment) => sum + payment.amount, 0) >= debt.totalAmount - 0.005
    );
    const closedIds = new Set(closedDebts.map(debt => debt.id));
    const previousIds = previousClosedDebtIdsRef.current;

    if (previousIds) {
      const newlyClosed = closedDebts.find(debt => !previousIds.has(debt.id));
      if (newlyClosed) {
        setDebtCelebration(newlyClosed.name);
        if (celebrationTimerRef.current) clearTimeout(celebrationTimerRef.current);
        celebrationTimerRef.current = setTimeout(() => setDebtCelebration(null), 2600);
      }
    }

    previousClosedDebtIdsRef.current = closedIds;
  }, [data]);

  useEffect(() => () => {
    if (celebrationTimerRef.current) clearTimeout(celebrationTimerRef.current);
  }, []);

  // Interactive dialog/modal state
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isAlert?: boolean;
    onConfirm: () => void;
    onCancel?: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {}
  });

  const triggerConfirm = (title: string, message: string, onConfirm: () => void, confirmText = "Yes", cancelText = "Cancel") => {
    setModalConfig({
      isOpen: true,
      title,
      message,
      confirmText,
      cancelText,
      isAlert: false,
      onConfirm: () => {
        onConfirm();
        setModalConfig(prev => ({ ...prev, isOpen: false }));
      },
      onCancel: () => {
        setModalConfig(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const triggerAlert = (title: string, message: string, confirmText = "OK") => {
    setModalConfig({
      isOpen: true,
      title,
      message,
      confirmText,
      isAlert: true,
      onConfirm: () => {
        setModalConfig(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Fetch data from API
  const fetchData = async (showLoader = false) => {
    if (showLoader) setLoading(true);
    setSyncStatus('syncing');
    try {
      const res = await apiFetch("/api/data");
      if (!res.ok) {
        const message = res.status === 401
          ? "Telegram authorization could not be verified. Close and reopen the Mini App."
          : "Unable to load data from the server.";
        throw new Error(message);
      }
      const rawJson = await res.json() as FinanceData & { workoutWeeks?: unknown };
      const hadWorkoutData = Object.prototype.hasOwnProperty.call(rawJson, "workoutWeeks");
      const json = { ...rawJson };
      delete json.workoutWeeks;
      const activeMonthSource = json.activeMonths?.length
        ? json.activeMonths
        : [getCurrentMonthStr(), ...json.monthlyBudgets.map(budget => budget.monthStr)];
      const normalizedActiveMonths = [...new Set(activeMonthSource)].sort();
      const needsActiveMonthRepair = JSON.stringify(json.activeMonths ?? []) !== JSON.stringify(normalizedActiveMonths);
      const normalizedJson: FinanceData = needsActiveMonthRepair
        ? { ...json, activeMonths: normalizedActiveMonths }
        : json;
      const needsCloudRepair = res.headers.get("X-Storage-Needs-Repair") === "true";
      const syncPending = res.headers.get("X-Storage-Sync-Pending") === "true";
      const reconciledData = normalizedJson.debts?.length
        ? { ...normalizedJson, debts: syncDebtPayments(normalizedJson.debts, normalizedJson.monthlyBudgets) }
        : normalizedJson;
      const debtSyncChanged = Boolean(normalizedJson.debts?.length) &&
        JSON.stringify(normalizedJson.debts) !== JSON.stringify(reconciledData.debts);
      setStoragePersistent(res.headers.get("X-Storage-Persistent") !== "false");
      setStorageProvider(res.headers.get("X-Storage-Provider"));
      setData(reconciledData);
      setErrorMsg(null);
      const optimizedSerialized = JSON.stringify(reconciledData);
      if (hadWorkoutData || needsCloudRepair || needsActiveMonthRepair || debtSyncChanged || syncPending) {
        setSyncStatus('syncing');
        saveQueueRef.current = saveQueueRef.current
          .catch(() => undefined)
          .then(async () => {
            const seedResponse = await apiFetch("/api/data/sync", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: optimizedSerialized,
            });
            if (!seedResponse.ok) throw new Error("Unable to finish initial cloud sync");
            setStoragePersistent(seedResponse.headers.get("X-Storage-Persistent") !== "false");
            setStorageProvider(seedResponse.headers.get("X-Storage-Provider"));
            lastPersistedDataRef.current = optimizedSerialized;
            setSyncStatus(seedResponse.headers.get("X-Storage-Sync-Pending") === "true" ? 'pending' : 'synced');
          })
          .catch(error => {
            console.error("Unable to finish initial cloud sync:", error);
            setSyncStatus('pending');
          });
      } else {
        lastPersistedDataRef.current = optimizedSerialized;
        setSyncStatus(syncPending ? 'pending' : 'synced');
      }
    } catch (err: any) {
      console.error("Sync error:", err);
      setSyncStatus('offline');
      setErrorMsg(err instanceof Error ? err.message : "The server connection was lost. Check your connection.");
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchData(true);
  }, []);

  const currentMonth = getCurrentMonthStr();
  const calculatedMonths = useMemo(
    () => data ? calculateMonthlyStats(data, currentMonth) : [],
    [data, currentMonth],
  );
  const expenseTemplates = useMemo(
    () => data ? buildExpenseTemplates(data) : [],
    [data],
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#06080d] flex flex-col items-center justify-center font-sans">
        <div className="space-y-4 text-center">
          <div className="relative w-12 h-12 mx-auto">
            <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20" />
            <div className="absolute inset-0 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
          </div>
          <p className="text-xs font-semibold text-slate-400 tracking-wide uppercase">Syncing data...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#06080d] flex items-center justify-center p-6 font-sans text-center">
        <div className="w-full max-w-sm rounded-3xl border border-white/[0.08] bg-white/[0.025] p-7 shadow-2xl">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-500/20 bg-rose-500/10 text-rose-400">
            <WifiOff size={21} />
          </div>
          <h1 className="text-sm font-black uppercase tracking-wider text-white">Unable to open your budget</h1>
          <p className="mt-2 text-xs leading-relaxed text-white/50">{errorMsg}</p>
          <button
            onClick={() => fetchData(true)}
            className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-5 py-2.5 text-xs font-black text-slate-950 transition hover:bg-emerald-400"
          >
            <RefreshCw size={13} /> Try again
          </button>
        </div>
      </div>
    );
  }

  // Helper to save state back to DB via Sync API
  const saveStateToDB = (updated: FinanceData) => {
    const serialized = JSON.stringify(updated);
    setData(updated);
    if (serialized === lastPersistedDataRef.current) {
      setSyncStatus(current => current === 'pending' ? 'pending' : 'synced');
      setErrorMsg(null);
      return;
    }
    const saveVersion = ++saveVersionRef.current;
    setSyncStatus('syncing');

    saveQueueRef.current = saveQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        if (saveVersion !== saveVersionRef.current) return;
        if (serialized === lastPersistedDataRef.current) return;
        const res = await apiFetch("/api/data/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: serialized
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => null) as { error?: string } | null;
          throw new Error(payload?.error || "Unable to save changes");
        }
        lastPersistedDataRef.current = serialized;
        if (saveVersion !== saveVersionRef.current) return;
        setStoragePersistent(res.headers.get("X-Storage-Persistent") !== "false");
        setStorageProvider(res.headers.get("X-Storage-Provider"));
        setSyncStatus(res.headers.get("X-Storage-Sync-Pending") === "true" ? 'pending' : 'synced');
        setErrorMsg(null);
      })
      .catch((err) => {
        if (saveVersion !== saveVersionRef.current) return;
        console.error("Save error:", err);
        const message = err instanceof Error ? err.message : "Unable to save changes. Check your connection.";
        setSyncStatus(message.startsWith("Saved on this device") ? 'pending' : 'offline');
        setErrorMsg(message);
      });
  };

  // Helper to ensure a monthly budget object exists for editing
  const getOrCreateMonthlyBudget = (currentData: FinanceData, monthStr: string) => {
    const budgets = [...currentData.monthlyBudgets];
    let index = budgets.findIndex(b => b.monthStr === monthStr);
    if (index === -1) {
      budgets.push({
        monthStr,
        income: currentData.baselineMonthlyIncome,
        expenses: []
      });
      index = budgets.length - 1;
    }
    return { budgets, index };
  };

  // --- ACTIONS ---

  // Set month income
  const handleUpdateMonthIncome = (monthStr: string, income: number) => {
    const { budgets, index } = getOrCreateMonthlyBudget(data, monthStr);
    budgets[index] = {
      ...budgets[index],
      income
    };
    const updated: FinanceData = {
      ...data,
      monthlyBudgets: budgets,
      debts: syncDebtPayments(data.debts ?? [], budgets),
    };
    saveStateToDB(updated);
  };

  const handleUpdateActualBalance = (monthStr: string, actualEndingBalance: number | null) => {
    const { budgets, index } = getOrCreateMonthlyBudget(data, monthStr);
    if (actualEndingBalance === null) {
      const { actualEndingBalance: _removed, ...budgetWithoutActualBalance } = budgets[index];
      budgets[index] = budgetWithoutActualBalance;
    } else {
      budgets[index] = { ...budgets[index], actualEndingBalance };
    }
    saveStateToDB({ ...data, monthlyBudgets: budgets });
  };

  // Add Expense to specific month
  const handleAddExpense = (monthStr: string, newExp: Omit<ExpenseItem, 'id'>) => {
    const { budgets, index } = getOrCreateMonthlyBudget(data, monthStr);
    const item: ExpenseItem = {
      ...newExp,
      id: generateId()
    };
    budgets[index] = {
      ...budgets[index],
      expenses: [...budgets[index].expenses, item]
    };
    const updated: FinanceData = {
      ...data,
      monthlyBudgets: budgets,
      debts: syncDebtPayments(data.debts ?? [], budgets),
    };
    saveStateToDB(updated);
  };

  // Edit Expense in specific month
  const handleEditExpense = (monthStr: string, editedExp: ExpenseItem) => {
    const { budgets, index } = getOrCreateMonthlyBudget(data, monthStr);
    budgets[index] = {
      ...budgets[index],
      expenses: budgets[index].expenses.map(e => e.id === editedExp.id ? editedExp : e)
    };
    const updated: FinanceData = {
      ...data,
      monthlyBudgets: budgets,
      debts: syncDebtPayments(data.debts ?? [], budgets),
    };
    saveStateToDB(updated);
  };

  // Delete Expense from specific month
  const handleDeleteExpense = (monthStr: string, expenseId: string) => {
    const { budgets, index } = getOrCreateMonthlyBudget(data, monthStr);
    budgets[index] = {
      ...budgets[index],
      expenses: budgets[index].expenses.filter(e => e.id !== expenseId)
    };
    const updated: FinanceData = {
      ...data,
      monthlyBudgets: budgets,
      debts: syncDebtPayments(data.debts ?? [], budgets),
    };
    saveStateToDB(updated);
  };

  // Toggle Completed checkbox instantly
  const handleToggleExpenseCompleted = (monthStr: string, expenseId: string) => {
    const { budgets, index } = getOrCreateMonthlyBudget(data, monthStr);
    budgets[index] = {
      ...budgets[index],
      expenses: budgets[index].expenses.map(e => e.id === expenseId ? { ...e, completed: !e.completed } : e)
    };
    const updated: FinanceData = {
      ...data,
      monthlyBudgets: budgets,
      debts: syncDebtPayments(data.debts ?? [], budgets),
    };
    saveStateToDB(updated);
  };

  const handleAddDebt = (name: string, totalAmount: number) => {
    const debt: DebtItem = {
      id: generateId(),
      name,
      totalAmount,
      createdAt: new Date().toISOString(),
      payments: [],
    };
    const debts = syncDebtPayments([...(data.debts ?? []), debt], data.monthlyBudgets);
    saveStateToDB({ ...data, debts });
  };

  const handleEditDebt = (debtId: string, name: string, totalAmount: number) => {
    const previousDebt = (data.debts ?? []).find(debt => debt.id === debtId);
    if (!previousDebt) return;
    const previousName = normalizeDebtTitle(previousDebt.name);
    const monthlyBudgets = data.monthlyBudgets.map(budget => ({
      ...budget,
      expenses: budget.expenses.map(expense =>
        expense.type !== "income" &&
        normalizeDebtTitle(expense.category) === "debt" &&
        normalizeDebtTitle(expense.description) === previousName
          ? { ...expense, description: name }
          : expense
      ),
    }));
    const updatedDebts = (data.debts ?? []).map(debt => debt.id === debtId
      ? { ...debt, name, totalAmount }
      : debt);
    const debts = syncDebtPayments(updatedDebts, monthlyBudgets);
    saveStateToDB({ ...data, monthlyBudgets, debts });
  };

  const handleDeleteDebt = (debtId: string) => {
    saveStateToDB({ ...data, debts: (data.debts ?? []).filter(debt => debt.id !== debtId) });
  };

  // Update Settings Baseline parameters
  const handleUpdateBaseline = (baselineMonthlyIncome: number, baselineBalance: number) => {
    const updated: FinanceData = {
      ...data,
      baselineMonthlyIncome,
      baselineBalance
    };
    saveStateToDB(updated);
  };

  const handleSaveExpenseTemplate = (templateId: string, override: ExpenseTemplateOverride) => {
    const requestedTitle = override.title?.trim();
    if (requestedTitle && expenseTemplates.some(template =>
      template.id !== templateId && normalizeDebtTitle(template.title) === normalizeDebtTitle(requestedTitle)
    )) {
      triggerAlert("Template already exists", "Use a different title or edit the existing template.");
      return;
    }
    if (templateId.startsWith("custom:")) {
      const customExpenseTemplates = (data.customExpenseTemplates ?? []).map(template => template.id === templateId
        ? {
            ...template,
            title: override.title?.trim() || template.title,
            category: override.category?.trim() || template.category,
            amount: override.amount === null ? undefined : override.amount ?? template.amount,
          }
        : template);
      saveStateToDB({ ...data, customExpenseTemplates });
      return;
    }
    const expenseTemplateOverrides = (data.expenseTemplateOverrides ?? []).filter(item => item.templateId !== templateId);
    expenseTemplateOverrides.push(override);
    saveStateToDB({ ...data, expenseTemplateOverrides });
  };

  const handleCreateExpenseTemplate = (template: Pick<ExpenseTemplate, "title" | "category" | "amount">) => {
    const customTemplate: ExpenseTemplate = {
      id: `custom:${generateId()}`,
      title: template.title.trim(),
      category: template.category.trim(),
      amount: template.amount,
      source: "custom",
    };
    saveStateToDB({
      ...data,
      customExpenseTemplates: [...(data.customExpenseTemplates ?? []), customTemplate],
    });
  };

  const handleResetExpenseTemplate = (templateId: string) => {
    saveStateToDB({
      ...data,
      expenseTemplateOverrides: (data.expenseTemplateOverrides ?? []).filter(item => item.templateId !== templateId),
    });
  };

  const handleSetExpenseTemplateHidden = (templateId: string, hidden: boolean) => {
    if (templateId.startsWith("custom:")) {
      saveStateToDB({
        ...data,
        customExpenseTemplates: (data.customExpenseTemplates ?? []).filter(template => template.id !== templateId),
        expenseTemplateOverrides: (data.expenseTemplateOverrides ?? []).filter(item => item.templateId !== templateId),
      });
      return;
    }
    const current = data.expenseTemplateOverrides ?? [];
    const existing = current.find(item => item.templateId === templateId) ?? { templateId };
    const expenseTemplateOverrides = current.filter(item => item.templateId !== templateId);
    expenseTemplateOverrides.push({ ...existing, hidden });
    saveStateToDB({ ...data, expenseTemplateOverrides });
  };

  // Clear All
  const handleClearAll = () => {
    const updated: FinanceData = {
      baselineMonthlyIncome: 0,
      baselineBalance: 0,
      monthlyBudgets: [],
      activeMonths: [getCurrentMonthStr()],
    };
    saveStateToDB(updated);
    setSelectedMonthStr(getCurrentMonthStr());
  };

  // Add a new month chronologically (sequential after the latest month)
  const handleAddMonth = () => {
    if (!data) return;
    const existingActive = data.activeMonths?.length
      ? [...data.activeMonths].sort()
      : [...new Set([getCurrentMonthStr(), ...data.monthlyBudgets.map(budget => budget.monthStr)])].sort();
    let maxMonthStr = existingActive[existingActive.length - 1] ?? getCurrentMonthStr();

    let [year, month] = maxMonthStr.split('-').map(Number);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
    const nextMonthStr = `${year}-${String(month).padStart(2, '0')}`;

    if (existingActive.includes(nextMonthStr)) {
      triggerAlert("Unable to add month", "This month has already been added.");
      return;
    }

    const newActiveMonths = [...existingActive, nextMonthStr].sort();
    const budgets = [...data.monthlyBudgets];
    if (!budgets.some(b => b.monthStr === nextMonthStr)) {
      budgets.push({
        monthStr: nextMonthStr,
        income: data.baselineMonthlyIncome,
        expenses: []
      });
    }

    const updated: FinanceData = {
      ...data,
      activeMonths: newActiveMonths,
      monthlyBudgets: budgets
    };
    saveStateToDB(updated);
    setSelectedMonthStr(nextMonthStr);
  };

  // Delete a month
  const handleDeleteMonth = (monthStr: string) => {
    if (!data) return;
    const existingActive = data.activeMonths?.length
      ? [...data.activeMonths].sort()
      : [...new Set([getCurrentMonthStr(), ...data.monthlyBudgets.map(budget => budget.monthStr)])].sort();

    if (existingActive.length <= 1) {
      triggerAlert("Unable to delete month", "At least one month must remain in the list.");
      return;
    }

    triggerConfirm(
      "Delete month",
      `Delete ${monthStr} and all of its transactions?`,
      () => {
        const newActiveMonths = existingActive.filter(m => m !== monthStr);
        const budgets = data.monthlyBudgets.filter(b => b.monthStr !== monthStr);

        const updated: FinanceData = {
          ...data,
          activeMonths: newActiveMonths,
          monthlyBudgets: budgets
        };
        saveStateToDB(updated);

        // Switch selected month if we just deleted the active one
        if (selectedMonthStr === monthStr) {
          const remaining = newActiveMonths.sort();
          const deletedIndex = existingActive.indexOf(monthStr);
          const nextSelect = remaining[Math.min(deletedIndex, remaining.length - 1)] || remaining[0];
          setSelectedMonthStr(nextSelect);
        }
      }
    );
  };

  return (
    <div className={`telegram-app-shell min-h-screen text-slate-100 font-sans flex flex-col pb-20 md:pb-0 relative overflow-hidden ${activeTab === "budget" ? "budget-screen" : ""}`}>

      {/* iOS Liquid Glass Background Glowing Orbs */}
      <div className="ambient-orb top-[-12%] left-[-14%] w-[52%] h-[48%] bg-blue-500/20" />
      <div className="ambient-orb top-[12%] right-[-18%] w-[48%] h-[52%] bg-violet-500/15 [animation-delay:-5s]" />
      <div className="ambient-orb bottom-[-12%] left-[22%] w-[58%] h-[50%] bg-emerald-500/14 [animation-delay:-9s]" />

      {/* GLOBAL NETWORK WARNING */}
      {errorMsg && (
        <div className="relative z-50 bg-rose-500/90 backdrop-blur-md text-white font-medium px-4 py-2 text-center text-xs shadow-lg flex items-center justify-center gap-2">
          <WifiOff size={14} />
          {errorMsg}
        </div>
      )}

      {storagePersistent === false && !errorMsg && (
        <div className="relative z-50 bg-amber-400/90 backdrop-blur-md text-amber-950 font-semibold px-4 py-2 text-center text-xs shadow-lg flex items-center justify-center gap-2">
          <Database size={14} />
          Development storage is temporary. Configure MySQL or PostgreSQL to keep data after a restart.
        </div>
      )}

      {/* TOP DESKTOP HEADER */}
      <header className="telegram-app-header liquid-header sticky top-0 z-40 px-4 py-3 md:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">

          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <img src={`${import.meta.env.BASE_URL}logo.png`} className="app-logo-image w-9 h-9 object-contain rounded-xl ring-1 ring-white/15 shadow-[0_8px_24px_rgba(16,185,129,0.18)]" alt="Logo" referrerPolicy="no-referrer" />
            <span
              className="app-figma-logo hidden h-[38px] w-[38px] p-1"
              style={{
                WebkitMaskImage: `url(${import.meta.env.BASE_URL}figma-logo-mask.svg)`,
                maskImage: `url(${import.meta.env.BASE_URL}figma-logo-mask.svg)`,
                WebkitMaskRepeat: "no-repeat",
                maskRepeat: "no-repeat",
                WebkitMaskPosition: "center",
                maskPosition: "center",
                WebkitMaskSize: "30px 30px",
                maskSize: "30px 30px",
              }}
              aria-hidden="true"
            >
              <img src={`${import.meta.env.BASE_URL}figma-logo-gradient.svg`} className="h-full w-full" alt="" />
            </span>
            <span className="app-brand-name text-xs font-black tracking-widest text-white/95 uppercase font-sans">Finance Tracker</span>
          </div>

          {/* Sync status & Manual refresh button */}
          <div className="flex items-center gap-3">
            <div className="app-sync-status liquid-glass flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px]">
              {syncStatus === 'synced' && (
                <>
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full shadow-[0_0_8px_#34d399]" />
                  <span className="app-sync-label text-white/60 font-medium">
                    {storagePersistent === false
                      ? "Saved temporarily"
                      : storageProvider === "telegram-cloud"
                        ? "Synced to Telegram"
                        : storageProvider === "browser"
                          ? "Saved on device"
                          : "Saved"}
                  </span>
                </>
              )}
              {syncStatus === 'syncing' && (
                <>
                  <RefreshCw size={10} className="text-emerald-400 animate-spin" />
                  <span className="app-sync-label text-emerald-400 font-medium">Saving...</span>
                </>
              )}
              {syncStatus === 'offline' && (
                <>
                  <span className="w-1.5 h-1.5 bg-rose-500 rounded-full" />
                  <span className="app-sync-label text-rose-400 font-medium">Offline</span>
                </>
              )}
              {syncStatus === 'pending' && (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_#fbbf24]" />
                  <span className="app-sync-label font-medium text-amber-300">Sync pending</span>
                </>
              )}
            </div>

            <button
              onClick={() => fetchData(false)}
              className="liquid-glass flex items-center justify-center rounded-full p-2 text-white/60 transition duration-200 hover:text-white"
              aria-label="Refresh data"
            >
              <span className="hidden md:block"><RefreshCw size={12} className={syncStatus === 'syncing' ? 'animate-spin' : ''} /></span>
              <span className={`hidden figma-mobile-icon leading-none ${syncStatus === 'syncing' ? 'animate-spin' : ''}`}><FigmaIcon name="refresh-2" size={14} /></span>
            </button>
          </div>
        </div>
      </header>

      {/* CORE CONTENT LAYOUT */}
      <div className="app-content max-w-7xl w-full mx-auto flex-1 flex flex-col md:flex-row p-4 md:p-6 gap-6 relative z-10">

        {/* DESKTOP SIDEBAR NAVIGATION */}
        <aside className="liquid-sidebar liquid-glass hidden md:block w-52 shrink-0 space-y-1">
          <button
            onClick={() => setActiveTab("budget")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-full text-xs font-semibold tracking-wide transition duration-150 cursor-pointer ${
              activeTab === "budget"
                ? "bg-white/[0.06] border border-white/[0.1] text-white shadow-[0_4px_12px_rgba(255,255,255,0.02)]"
                : "text-white/50 hover:text-white hover:bg-white/[0.03] border border-transparent"
            }`}
          >
            <Wallet size={16} />
            Monthly Budget
          </button>

          <button
            onClick={() => setActiveTab("projections")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-full text-xs font-semibold tracking-wide transition duration-150 cursor-pointer ${
              activeTab === "projections"
                ? "bg-white/[0.06] border border-white/[0.1] text-white shadow-[0_4px_12px_rgba(255,255,255,0.02)]"
                : "text-white/50 hover:text-white hover:bg-white/[0.03] border border-transparent"
            }`}
          >
            <Calendar size={16} />
            History & Plans
          </button>

          <button
            onClick={() => setActiveTab("debts")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-full text-xs font-semibold tracking-wide transition duration-150 cursor-pointer ${
              activeTab === "debts"
                ? "bg-white/[0.06] border border-white/[0.1] text-white shadow-[0_4px_12px_rgba(255,255,255,0.02)]"
                : "text-white/50 hover:text-white hover:bg-white/[0.03] border border-transparent"
            }`}
          >
            <HandCoins size={16} />
            Debts
          </button>

          <button
            onClick={() => setActiveTab("settings")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-full text-xs font-semibold tracking-wide transition duration-150 cursor-pointer ${
              activeTab === "settings" || activeTab === "template-settings"
                ? "bg-white/[0.06] border border-white/[0.1] text-white shadow-[0_4px_12px_rgba(255,255,255,0.02)]"
                : "text-white/50 hover:text-white hover:bg-white/[0.03] border border-transparent"
            }`}
          >
            <Settings size={16} />
            Settings
          </button>
        </aside>

        {/* MAIN VIEW CONTROLLER */}
        <main className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              {activeTab === "budget" && (
                <DashboardView
                  calculatedMonths={calculatedMonths}
                  selectedMonthStr={selectedMonthStr}
                  onSetSelectedMonthStr={setSelectedMonthStr}
                  onUpdateMonthIncome={handleUpdateMonthIncome}
                  onAddExpense={handleAddExpense}
                  onEditExpense={handleEditExpense}
                  onDeleteExpense={handleDeleteExpense}
                  onToggleExpenseCompleted={handleToggleExpenseCompleted}
                  expenseTemplates={expenseTemplates}
                  onAddMonth={handleAddMonth}
                  onDeleteMonth={handleDeleteMonth}
                  triggerConfirm={triggerConfirm}
                  triggerAlert={triggerAlert}
                />
              )}

              {activeTab === "template-settings" && (
                <TemplateSettingsView
                  templates={expenseTemplates}
                  overrides={data.expenseTemplateOverrides ?? []}
                  onBack={() => setActiveTab("settings")}
                  onCreate={handleCreateExpenseTemplate}
                  onSave={handleSaveExpenseTemplate}
                  onReset={handleResetExpenseTemplate}
                  onDelete={templateId => handleSetExpenseTemplateHidden(templateId, true)}
                  triggerConfirm={triggerConfirm}
                  triggerAlert={triggerAlert}
                />
              )}

              {activeTab === "projections" && (
                <FutureView
                  calculatedMonths={calculatedMonths}
                  onSelectMonth={setSelectedMonthStr}
                  onUpdateActualBalance={handleUpdateActualBalance}
                  onNavigateToEditor={() => setActiveTab("budget")}
                  onAddMonth={handleAddMonth}
                  onDeleteMonth={handleDeleteMonth}
                  triggerAlert={triggerAlert}
                />
              )}

              {activeTab === "debts" && (
                <DebtView
                  debts={data.debts ?? []}
                  onAddDebt={handleAddDebt}
                  onEditDebt={handleEditDebt}
                  onDeleteDebt={handleDeleteDebt}
                  triggerConfirm={triggerConfirm}
                  triggerAlert={triggerAlert}
                />
              )}

              {activeTab === "settings" && (
                <SettingsView
                  data={data}
                  onUpdateBaseline={handleUpdateBaseline}
                  onClearAll={handleClearAll}
                  triggerConfirm={triggerConfirm}
                  triggerAlert={triggerAlert}
                  onOpenTemplates={() => setActiveTab("template-settings")}
                  templateCount={expenseTemplates.length}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="telegram-bottom-nav liquid-tab-bar md:hidden fixed z-40 flex items-center justify-around">
        <button
          onClick={() => setActiveTab("budget")}
          aria-current={activeTab === "budget" ? "page" : undefined}
          className={`flex flex-col items-center justify-center flex-1 h-full rounded-xl transition cursor-pointer ${
            activeTab === "budget" ? "text-emerald-400" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <FigmaIcon name={activeTab === "budget" ? "wallet-money" : "wallet"} size={24} />
          <span className="app-nav-label text-[10px] font-semibold mt-1">Budget</span>
        </button>

        <button
          onClick={() => setActiveTab("projections")}
          aria-current={activeTab === "projections" ? "page" : undefined}
          className={`flex flex-col items-center justify-center flex-1 h-full rounded-xl transition cursor-pointer ${
            activeTab === "projections" ? "text-emerald-400" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <FigmaIcon name={activeTab === "projections" ? "calendar-edit-bold" : "calendar-edit"} size={24} />
          <span className="app-nav-label text-[10px] font-semibold mt-1">Plans</span>
        </button>

        <button
          onClick={() => setActiveTab("debts")}
          aria-current={activeTab === "debts" ? "page" : undefined}
          className={`flex flex-col items-center justify-center flex-1 h-full rounded-xl transition cursor-pointer ${
            activeTab === "debts" ? "text-emerald-400" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <FigmaIcon name={activeTab === "debts" ? "money-send-bold" : "money-send"} size={24} />
          <span className="app-nav-label text-[10px] font-semibold mt-1">Debts</span>
        </button>

        <button
          onClick={() => setActiveTab("settings")}
          aria-current={activeTab === "settings" || activeTab === "template-settings" ? "page" : undefined}
          className={`flex flex-col items-center justify-center flex-1 h-full rounded-xl transition cursor-pointer ${
            activeTab === "settings" || activeTab === "template-settings" ? "text-emerald-400" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <FigmaIcon name={activeTab === "settings" || activeTab === "template-settings" ? "more-bold" : "more"} size={24} />
          <span className="app-nav-label text-[10px] font-semibold mt-1">Settings</span>
        </button>
      </nav>

      {debtCelebration && (
        <div className="debt-celebration pointer-events-none fixed inset-x-0 top-[22%] z-[70] flex justify-center px-4" role="status" aria-live="polite">
          <div className="debt-confetti" aria-hidden="true">
            {Array.from({ length: 10 }, (_, index) => <span key={index} />)}
          </div>
          <div className="liquid-glass-strong debt-celebration-card flex items-center gap-3 rounded-full border border-emerald-300/25 px-5 py-3.5 shadow-[0_20px_60px_rgba(16,185,129,0.28)]">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-400 text-slate-950">
              <PartyPopper size={19} />
            </div>
            <div>
              <p className="text-sm font-black text-white">Debt paid off!</p>
              <p className="max-w-52 truncate text-[10px] text-emerald-200/65">{debtCelebration}</p>
            </div>
          </div>
        </div>
      )}

      {/* Glassmorphic Global Confirmation/Alert Modal */}
      <ConfirmModal
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        message={modalConfig.message}
        confirmText={modalConfig.confirmText}
        cancelText={modalConfig.cancelText}
        isAlert={modalConfig.isAlert}
        onConfirm={modalConfig.onConfirm}
        onCancel={modalConfig.onCancel}
      />

    </div>
  );
}
