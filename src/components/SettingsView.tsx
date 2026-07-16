import React, { useState } from "react";
import { FinanceData } from "../types";
import { 
  Sliders, 
  Trash2, 
  AlertOctagon,
  CheckCircle,
  Database
} from "lucide-react";

interface SettingsViewProps {
  data: FinanceData;
  onUpdateBaseline: (baselineMonthlyIncome: number, baselineBalance: number) => void;
  onResetToDemo: () => void;
  onClearAll: () => void;
  triggerConfirm: (title: string, message: string, onConfirm: () => void) => void;
  triggerAlert: (title: string, message: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  data,
  onUpdateBaseline,
  onResetToDemo,
  onClearAll,
  triggerConfirm,
  triggerAlert
}) => {
  const [baselineIncome, setBaselineIncome] = useState<string>(data.baselineMonthlyIncome.toString());
  const [baselineBalance, setBaselineBalance] = useState<string>(data.baselineBalance.toString());
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedIncome = parseFloat(baselineIncome);
    const parsedBalance = parseFloat(baselineBalance);
    
    if (isNaN(parsedIncome) || isNaN(parsedBalance)) {
      triggerAlert("Validation Error", "Please enter valid numeric values.");
      return;
    }

    onUpdateBaseline(parsedIncome, parsedBalance);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* TITLE */}
      <div>
        <h2 className="text-xl font-black text-white tracking-tight uppercase">Settings</h2>
      </div>

      {/* CORE PARAMS CARD */}
      <div className="bg-white/[0.015] backdrop-blur-xl border border-white/[0.06] rounded-3xl p-5 shadow-[0_8px_32px_0_rgba(0,0,0,0.2)]">
        <h3 className="text-xs font-bold text-white/95 uppercase tracking-wider flex items-center gap-2 pb-3.5 border-b border-white/[0.06] mb-4">
          <Sliders size={14} className="text-emerald-400" />
          Baseline Parameters
        </h3>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Baseline Monthly Income ($) *</label>
              <input
                type="number"
                required
                value={baselineIncome}
                onChange={(e) => setBaselineIncome(e.target.value)}
                className="w-full bg-black/25 border border-white/[0.08] focus:border-emerald-500/50 rounded-xl px-3 py-2.5 text-xs text-white font-mono outline-none transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Starting Accumulated Savings ($) *</label>
              <input
                type="number"
                required
                value={baselineBalance}
                onChange={(e) => setBaselineBalance(e.target.value)}
                className="w-full bg-black/25 border border-white/[0.08] focus:border-emerald-500/50 rounded-xl px-3 py-2.5 text-xs text-white font-mono outline-none transition"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-1.5 text-[10px] text-white/30 font-medium font-mono">
              <Database size={11} className="text-emerald-400" />
              <span>Database synced to cloud</span>
            </div>
            
            <button
              type="submit"
              className="px-4 py-2 bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-white font-semibold text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5"
            >
              {isSaved ? (
                <>
                  <CheckCircle size={13} className="text-emerald-400" /> Saved
                </>
              ) : (
                "Save Parameters"
              )}
            </button>
          </div>
        </form>
      </div>

      {/* DANGEROUS ZONE - Minimal design */}
      <div className="bg-white/[0.015] backdrop-blur-xl border border-white/[0.06] rounded-3xl p-5 shadow-[0_8px_32px_0_rgba(0,0,0,0.2)] space-y-4">
        <h3 className="text-xs font-bold text-rose-400/90 uppercase tracking-wider flex items-center gap-2 pb-3.5 border-b border-white/[0.06]">
          <AlertOctagon size={14} />
          Reset & Clear Data
        </h3>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5">
            <h4 className="font-semibold text-white/85">Restore Demo Template</h4>
          </div>
          <button
            onClick={() => {
              triggerConfirm(
                "Restore Demo Template",
                "Are you sure you want to restore the demo template data? All of your current records will be overwritten.",
                onResetToDemo
              );
            }}
            className="px-3 py-1.5 border border-white/[0.08] hover:border-white/[0.2] hover:bg-white/[0.04] rounded-xl text-white/70 hover:text-white font-semibold transition cursor-pointer text-center shrink-0"
          >
            Restore Demo
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs pt-3 border-t border-white/[0.06]">
          <div className="space-y-0.5">
            <h4 className="font-semibold text-white/85">Clear Entire Database</h4>
          </div>
          <button
            onClick={() => {
              triggerConfirm(
                "Reset Database",
                "WARNING! Are you absolutely sure you want to completely clear the database? This action is irreversible.",
                onClearAll
              );
            }}
            className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500 border border-rose-500/20 hover:border-transparent text-rose-400 hover:text-slate-950 font-bold rounded-xl transition cursor-pointer text-center shrink-0 flex items-center gap-1"
          >
            <Trash2 size={12} /> Clear Database
          </button>
        </div>
      </div>
    </div>
  );
};
