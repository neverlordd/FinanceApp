import { useState, useEffect } from "react";
import { FinanceData, ExpenseItem } from "./types";
import { calculateMonthlyStats, CalculatedMonth } from "./utils/calculations";
import { DashboardView } from "./components/DashboardView";
import { FutureView } from "./components/FutureView";
import { SettingsView } from "./components/SettingsView";
import { ConfirmModal } from "./components/ConfirmModal";
import { 
  Wallet, 
  Calendar, 
  Settings, 
  RefreshCw, 
  WifiOff,
  LineChart
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// Generate ID helper
const generateId = () => Math.random().toString(36).substring(2, 11);

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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
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

  const triggerConfirm = (title: string, message: string, onConfirm: () => void, confirmText = "Да", cancelText = "Отмена") => {
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

  const triggerAlert = (title: string, message: string, confirmText = "ОК") => {
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
      const res = await fetch("/api/data");
      if (!res.ok) throw new Error("Не удалось загрузить данные с сервера");
      const json = await res.json() as FinanceData;
      setData(json);
      setSyncStatus('synced');
      setErrorMsg(null);
    } catch (err: any) {
      console.error("Sync error:", err);
      setSyncStatus('offline');
      setErrorMsg("Связь с сервером потеряна. Проверьте подключение.");
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchData(true);
  }, []);

  // Background active polling sync every 8 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      fetchData(false);
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-[#06080d] flex flex-col items-center justify-center font-sans">
        <div className="space-y-4 text-center">
          <div className="relative w-12 h-12 mx-auto">
            <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20" />
            <div className="absolute inset-0 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
          </div>
          <p className="text-xs font-semibold text-slate-400 tracking-wide uppercase">Синхронизация данных...</p>
        </div>
      </div>
    );
  }

  // Calculate forward projections and statistics cascading recursively
  const currentMonth = getCurrentMonthStr();
  const calculatedMonths = calculateMonthlyStats(data, currentMonth);

  // Helper to save state back to DB via Sync API
  const saveStateToDB = async (updated: FinanceData) => {
    setData(updated);
    setSyncStatus('syncing');
    try {
      const res = await fetch("/api/data/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated)
      });
      if (!res.ok) throw new Error("Не удалось синхронизировать изменения");
      setSyncStatus('synced');
    } catch (err) {
      console.error("Save error:", err);
      setSyncStatus('offline');
      triggerAlert("Сбой сохранения", "Ошибка при сохранении на сервере. Изменения сохранятся при восстановлении связи.");
    }
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
                category: "Работа",
                description: "Вычет за аванс (2-я часть)",
                amount: 675,
                completed: true
              },
              {
                id: "aug-2",
                category: "Долги",
                description: "Долг Жене",
                amount: 150,
                completed: true
              },
              {
                id: "aug-3",
                category: "Долги",
                description: "Долг Амалю (остаток)",
                amount: 175,
                completed: true
              },
              {
                id: "aug-4",
                category: "Долги",
                description: "Долг Андрею",
                amount: 250,
                completed: true
              },
              {
                id: "aug-5",
                category: "Долги",
                description: "Малому",
                amount: 50,
                completed: false
              },
              {
                id: "aug-6",
                category: "Жилье",
                description: "Аренда квартиры",
                amount: 270,
                completed: false
              },
              {
                id: "aug-7",
                category: "Жизнь",
                description: "Еда и быт (Тбилиси)",
                amount: 189.39,
                completed: false
              }
            ]
          }
        ]
      };
      const res = await fetch("/api/data/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(demoData)
      });
      const json = await res.json();
      setData(json.data);
      setSyncStatus('synced');
      setSelectedMonthStr("2026-08"); // Focus August after reset
    } catch (e) {
      triggerAlert("Сбой сброса", "Не удалось восстановить демонстрационный пример.");
    } finally {
      setLoading(false);
    }
  };

  // Clear All
  const handleClearAll = () => {
    const updated: FinanceData = {
      baselineMonthlyIncome: 2000,
      baselineBalance: 0,
      monthlyBudgets: []
    };
    saveStateToDB(updated);
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
      triggerAlert("Ошибка добавления", "Этот месяц уже добавлен!");
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
      triggerAlert("Deletion Impossible", "Cannot delete the only remaining month!");
      return;
    }
    
    triggerConfirm(
      "Delete Month",
      `Are you sure you want to delete month ${monthStr} and all of its associated transactions?`,
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
    <div className="min-h-screen bg-[#06080d] text-slate-100 font-sans flex flex-col pb-20 md:pb-0 relative overflow-hidden">
      
      {/* iOS Liquid Glass Background Glowing Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-500/8 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-emerald-600/8 blur-[150px] pointer-events-none" />
      <div className="absolute top-[40%] left-[20%] w-[45%] h-[45%] rounded-full bg-green-500/5 blur-[140px] pointer-events-none" />
      
      {/* GLOBAL NETWORK WARNING */}
      {errorMsg && (
        <div className="relative z-50 bg-rose-500/90 backdrop-blur-md text-white font-medium px-4 py-2 text-center text-xs shadow-lg flex items-center justify-center gap-2">
          <WifiOff size={14} />
          {errorMsg}
        </div>
      )}

      {/* TOP DESKTOP HEADER */}
      <header className="relative z-40 bg-white/[0.01] backdrop-blur-xl border-b border-white/[0.06] px-4 py-3 md:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" className="w-8 h-8 object-contain rounded-lg" alt="Logo" referrerPolicy="no-referrer" />
            <span className="text-xs font-black tracking-widest text-white/95 uppercase font-sans">Finance Tracker</span>
          </div>

          {/* Sync status & Manual refresh button */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/[0.02] border border-white/[0.06] rounded-full text-[10px]">
              {syncStatus === 'synced' && (
                <>
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full shadow-[0_0_8px_#34d399]" />
                  <span className="text-white/60 font-medium">Synced</span>
                </>
              )}
              {syncStatus === 'syncing' && (
                <>
                  <RefreshCw size={10} className="text-emerald-400 animate-spin" />
                  <span className="text-emerald-400 font-medium">Syncing...</span>
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
              className="p-1.5 bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl text-white/60 hover:text-white transition duration-200 cursor-pointer"
              title="Sync now"
            >
              <RefreshCw size={12} className={syncStatus === 'syncing' ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </header>

      {/* CORE CONTENT LAYOUT */}
      <div className="max-w-7xl w-full mx-auto flex-1 flex flex-col md:flex-row p-4 md:p-6 gap-6 relative z-10">
        
        {/* DESKTOP SIDEBAR NAVIGATION */}
        <aside className="hidden md:block w-52 shrink-0 space-y-1">
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
                  onUpdateMonthIncome={handleUpdateMonthIncome}
                  triggerConfirm={triggerConfirm}
                  triggerAlert={triggerAlert}
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
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#070b13]/95 backdrop-blur-md border-t border-slate-800/80 px-2 py-1 shadow-2xl flex items-center justify-around h-14">
        <button
          onClick={() => setActiveTab("budget")}
          className={`flex flex-col items-center justify-center flex-1 h-full rounded-xl transition cursor-pointer ${
            activeTab === "budget" ? "text-emerald-400" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Wallet size={18} />
          <span className="text-[9px] font-medium mt-1">Budget</span>
        </button>
        
        <button
          onClick={() => setActiveTab("projections")}
          className={`flex flex-col items-center justify-center flex-1 h-full rounded-xl transition cursor-pointer ${
            activeTab === "projections" ? "text-emerald-400" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Calendar size={18} />
          <span className="text-[9px] font-medium mt-1">Stats</span>
        </button>
        
        <button
          onClick={() => setActiveTab("settings")}
          className={`flex flex-col items-center justify-center flex-1 h-full rounded-xl transition cursor-pointer ${
            activeTab === "settings" ? "text-emerald-400" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Settings size={18} />
          <span className="text-[9px] font-medium mt-1">Settings</span>
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
