import React, { useEffect, useState } from "react";
import { FinanceData } from "../types";
import {
  Sliders,
  Trash2,
  AlertOctagon,
  CheckCircle,
  ChevronRight,
  Sparkles
} from "lucide-react";

interface SettingsViewProps {
  data: FinanceData;
  onUpdateBaseline: (baselineMonthlyIncome: number, baselineBalance: number) => void;
  onClearAll: () => void;
  triggerConfirm: (title: string, message: string, onConfirm: () => void) => void;
  triggerAlert: (title: string, message: string) => void;
  onOpenTemplates: () => void;
  templateCount: number;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  data,
  onUpdateBaseline,
  onClearAll,
  triggerConfirm,
  triggerAlert,
  onOpenTemplates,
  templateCount
}) => {
  const [baselineIncome, setBaselineIncome] = useState<string>(data.baselineMonthlyIncome.toString());
  const [baselineBalance, setBaselineBalance] = useState<string>(data.baselineBalance.toString());
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    setBaselineIncome(data.baselineMonthlyIncome.toString());
    setBaselineBalance(data.baselineBalance.toString());
  }, [data.baselineMonthlyIncome, data.baselineBalance]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedIncome = parseFloat(baselineIncome);
    const parsedBalance = parseFloat(baselineBalance);

    if (!Number.isFinite(parsedIncome) || parsedIncome < 0 || !Number.isFinite(parsedBalance)) {
      triggerAlert("Check your entries", "Income must be zero or greater, and the balance must be a valid number.");
      return;
    }

    onUpdateBaseline(parsedIncome, parsedBalance);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="space-y-5 md:space-y-6 max-w-2xl">
      {/* TITLE */}
      <div>
        <h2 className="text-xl font-black text-white tracking-tight uppercase">Settings</h2>
      </div>

      <button
        type="button"
        onClick={onOpenTemplates}
        className="liquid-glass flex min-h-16 w-full items-center gap-3 rounded-full px-5 py-3.5 text-left transition hover:border-emerald-400/25 hover:bg-white/[0.06]"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-400/12 text-emerald-300">
          <Sparkles size={17} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-white">Expense Templates</span>
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-white/35">{templateCount} active</span>
        </span>
        <ChevronRight size={17} className="shrink-0 text-white/35" />
      </button>

      {/* CORE PARAMS CARD */}
      <div className="liquid-glass rounded-3xl p-5 md:p-6">
        <h3 className="text-xs font-bold text-white/95 uppercase tracking-wider flex items-center gap-2 pb-3.5 border-b border-white/[0.06] mb-4">
          <Sliders size={14} className="text-emerald-400" />
          Baseline Parameters
        </h3>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Monthly Income ($) *</label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={baselineIncome}
                onChange={(e) => setBaselineIncome(e.target.value)}
                className="liquid-input w-full border focus:border-emerald-500/50 rounded-xl px-3 py-2.5 text-xs text-white font-mono outline-none transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Starting Balance ($) *</label>
              <input
                type="number"
                required
                step="0.01"
                value={baselineBalance}
                onChange={(e) => setBaselineBalance(e.target.value)}
                className="liquid-input w-full border focus:border-emerald-500/50 rounded-xl px-3 py-2.5 text-xs text-white font-mono outline-none transition"
              />
            </div>
          </div>

          <div className="flex items-center justify-end pt-2">
            <button
              type="submit"
              className="px-5 py-2.5 bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-white font-semibold text-xs rounded-full transition cursor-pointer flex items-center gap-1.5"
            >
              {isSaved ? (
                <>
                  <CheckCircle size={13} className="text-emerald-400" /> Saved
                </>
              ) : (
                "Save"
              )}
            </button>
          </div>
        </form>
      </div>

      {/* DANGEROUS ZONE - Minimal design */}
      <div className="liquid-glass rounded-3xl p-5 md:p-6 space-y-4">
        <h3 className="text-xs font-bold text-rose-400/90 uppercase tracking-wider flex items-center gap-2 pb-3.5 border-b border-white/[0.06]">
          <AlertOctagon size={14} />
          Reset Data
        </h3>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5">
            <h4 className="font-semibold text-white/85">Clear All Data</h4>
          </div>
          <button
            onClick={() => {
              triggerConfirm(
                "Clear data",
                "Delete all income, expenses, and baseline values? This action cannot be undone.",
                onClearAll
              );
            }}
            className="px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500 border border-rose-500/20 hover:border-transparent text-rose-400 hover:text-slate-950 font-bold rounded-full transition cursor-pointer text-center shrink-0 flex items-center gap-1"
          >
            <Trash2 size={12} /> Clear
          </button>
        </div>
      </div>
    </div>
  );
};
