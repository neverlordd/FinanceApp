import { useState, useEffect, useRef } from "react";
import { FinanceData, ExpenseItem } from "./types";
import { calculateMonthlyStats, CalculatedMonth } from "./utils/calculations";
import { DashboardView } from "./components/DashboardView";
import { FutureView } from "./components/FutureView";
import { SettingsView } from "./components/SettingsView";
import { ConfirmModal } from "./components/ConfirmModal";
import { apiFetch } from "./api";
import {
  Wallet,
  Calendar,
  Settings,
  RefreshCw,
  WifiOff,
  LineChart,
  Database
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

export default function App() {
  // Navigation State
  const [activeTab, setActiveTab] = useState<string>("budget");

  // Finance State
  const [data, setData] = useState<FinanceData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'offline'>('syncing');
  const [storagePersistent, setStoragePersistent] = useState<boolean | null>(null);
  const [storageProvider, setStorageProvider] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  // Month Selection State
  const [selectedMonthStr, setSelectedMonthStr] = useState<string>(getCurrentMonthStr());

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
      const json = await res.json() as FinanceData;
      setStoragePersistent(res.headers.get("X-Storage-Persistent") !== "false");
      setStorageProvider(res.headers.get("X-Storage-Provider"));
      setData(json);
      setSyncStatus('synced');
      setErrorMsg(null);
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

  // Calculate forward projections and statistics cascading recursively
  const currentMonth = getCurrentMonthStr();
  const calculatedMonths = calculateMonthlyStats(data, currentMonth);

  // Helper to save state back to DB via Sync API
  const saveStateToDB = (updated: FinanceData) => {
    setData(updated);
    setSyncStatus('syncing');

    saveQueueRef.current = saveQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        const res = await apiFetch("/api/data/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updated)
        });
        if (!res.ok) throw new Error("Unable to save changes");
        setStoragePersistent(res.headers.get("X-Storage-Persistent") !== "false");
        setStorageProvider(res.headers.get("X-Storage-Provider"));
        setSyncStatus('synced');
        setErrorMsg(null);
      })
      .catch((err) => {
        console.error("Save error:", err);
        setSyncStatus('offline');
        setErrorMsg("Changes were not saved. Check your connection and try again.");
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
      monthlyBudgets: budgets
    };
    saveStateToDB(updated);
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
      monthlyBudgets: budgets
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
      monthlyBudgets: budgets
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
      monthlyBudgets: budgets
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
      monthlyBudgets: budgets
    };
    saveStateToDB(updated);
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

  // Reset to screenshot Demo Data
  const handleResetToDemo = async () => {
    setLoading(true);
    try {
      const demoData: FinanceData = {
        baselineMonthlyIncome: 3000,
        baselineBalance: 1500,
        monthlyBudgets: [
          {
            monthStr: "2026-08",
            income: 3000,
            expenses: [
              {
                id: "aug-1",
                category: "Work",
                description: "Salary advance deduction (part 2)",
                amount: 675,
                completed: true
              },
              {
                id: "aug-2",
                category: "Debt",
                description: "Debt to spouse",
                amount: 150,
                completed: true
              },
              {
                id: "aug-3",
                category: "Debt",
                description: "Debt to Amal (remaining)",
                amount: 175,
                completed: true
              },
              {
                id: "aug-4",
                category: "Debt",
                description: "Debt to Andrey",
                amount: 250,
                completed: true
              },
              {
                id: "aug-5",
                category: "Debt",
                description: "Small debt",
                amount: 50,
                completed: false
              },
              {
                id: "aug-6",
                category: "Housing",
                description: "Apartment rent",
                amount: 270,
                completed: false
              },
              {
                id: "aug-7",
                category: "Living",
                description: "Food and household expenses (Tbilisi)",
                amount: 189.39,
                completed: false
              }
            ]
          }
        ]
      };
      const res = await apiFetch("/api/data/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(demoData)
      });
      if (!res.ok) throw new Error("Unable to restore the demo data");
      const json = await res.json();
      setStoragePersistent(res.headers.get("X-Storage-Persistent") !== "false");
      setStorageProvider(res.headers.get("X-Storage-Provider"));
      setData(json.data);
      setSyncStatus('synced');
      setSelectedMonthStr("2026-08"); // Focus August after reset
    } catch (e) {
      triggerAlert("Reset failed", "The demo data could not be restored.");
    } finally {
      setLoading(false);
    }
  };

  // Clear All
  const handleClearAll = () => {
    const updated: FinanceData = {
      baselineMonthlyIncome: 0,
      baselineBalance: 0,
      monthlyBudgets: []
    };
    saveStateToDB(updated);
    setSelectedMonthStr(getCurrentMonthStr());
  };

  // Add a new month chronologically (sequential after the latest month)
  const handleAddMonth = () => {
    if (!data) return;
    const currentSequence = calculatedMonths.map(m => m.monthStr);
    let maxMonthStr = currentSequence.length > 0 ? currentSequence[currentSequence.length - 1] : getCurrentMonthStr();

    let [year, month] = maxMonthStr.split('-').map(Number);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
    const nextMonthStr = `${year}-${String(month).padStart(2, '0')}`;

    const existingActive = data.activeMonths || currentSequence;
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
    const currentSequence = calculatedMonths.map(m => m.monthStr);
    const existingActive = data.activeMonths || currentSequence;

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
    <div className="telegram-app-shell min-h-screen text-slate-100 font-sans flex flex-col pb-20 md:pb-0 relative overflow-hidden">

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
            <img src={`${import.meta.env.BASE_URL}logo.png`} className="w-9 h-9 object-contain rounded-xl ring-1 ring-white/15 shadow-[0_8px_24px_rgba(16,185,129,0.18)]" alt="Logo" referrerPolicy="no-referrer" />
            <span className="app-brand-name text-xs font-black tracking-widest text-white/95 uppercase font-sans">Finance Tracker</span>
          </div>

          {/* Sync status & Manual refresh button */}
          <div className="flex items-center gap-3">
            <div className="liquid-glass flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px]">
              {syncStatus === 'synced' && (
                <>
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full shadow-[0_0_8px_#34d399]" />
                  <span className="text-white/60 font-medium">
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
                  <span className="text-emerald-400 font-medium">Saving...</span>
                </>
              )}
              {syncStatus === 'offline' && (
                <>
                  <span className="w-1.5 h-1.5 bg-rose-500 rounded-full" />
                  <span className="text-rose-400 font-medium">Offline</span>
                </>
              )}
            </div>

            <button
              onClick={() => fetchData(false)}
              className="liquid-glass p-2 rounded-xl text-white/60 hover:text-white transition duration-200 cursor-pointer"
              title="Refresh data"
            >
              <RefreshCw size={12} className={syncStatus === 'syncing' ? 'animate-spin' : ''} />
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
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold tracking-wide transition duration-150 cursor-pointer ${
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
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold tracking-wide transition duration-150 cursor-pointer ${
              activeTab === "projections"
                ? "bg-white/[0.06] border border-white/[0.1] text-white shadow-[0_4px_12px_rgba(255,255,255,0.02)]"
                : "text-white/50 hover:text-white hover:bg-white/[0.03] border border-transparent"
            }`}
          >
            <Calendar size={16} />
            History & Plans
          </button>

          <button
            onClick={() => setActiveTab("settings")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold tracking-wide transition duration-150 cursor-pointer ${
              activeTab === "settings"
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
                  onAddMonth={handleAddMonth}
                  onDeleteMonth={handleDeleteMonth}
                  triggerConfirm={triggerConfirm}
                  triggerAlert={triggerAlert}
                />
              )}

              {activeTab === "projections" && (
                <FutureView
                  calculatedMonths={calculatedMonths}
                  selectedMonthStr={selectedMonthStr}
                  onSelectMonth={setSelectedMonthStr}
                  onNavigateToEditor={() => setActiveTab("budget")}
                  onAddMonth={handleAddMonth}
                  onDeleteMonth={handleDeleteMonth}
                />
              )}

              {activeTab === "settings" && (
                <SettingsView
                  data={data}
                  onUpdateBaseline={handleUpdateBaseline}
                  onResetToDemo={handleResetToDemo}
                  onClearAll={handleClearAll}
                  triggerConfirm={triggerConfirm}
                  triggerAlert={triggerAlert}
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
          <Wallet size={19} />
          <span className="text-[10px] font-semibold mt-1">Budget</span>
        </button>

        <button
          onClick={() => setActiveTab("projections")}
          aria-current={activeTab === "projections" ? "page" : undefined}
          className={`flex flex-col items-center justify-center flex-1 h-full rounded-xl transition cursor-pointer ${
            activeTab === "projections" ? "text-emerald-400" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Calendar size={19} />
          <span className="text-[10px] font-semibold mt-1">Plans</span>
        </button>

        <button
          onClick={() => setActiveTab("settings")}
          aria-current={activeTab === "settings" ? "page" : undefined}
          className={`flex flex-col items-center justify-center flex-1 h-full rounded-xl transition cursor-pointer ${
            activeTab === "settings" ? "text-emerald-400" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Settings size={19} />
          <span className="text-[10px] font-semibold mt-1">Settings</span>
        </button>
      </nav>

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
