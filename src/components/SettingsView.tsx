import React, { useEffect, useState } from "react";
import { FinanceData } from "../types";
import { FigmaIcon } from "./FigmaIcon";

interface SettingsViewProps {
  data: FinanceData;
  onUpdateBaseline: (baselineMonthlyIncome: number, baselineBalance: number) => void;
  onClearAll: () => void;
  triggerConfirm: (title: string, message: string, onConfirm: () => void) => void;
  triggerAlert: (title: string, message: string) => void;
  onOpenTemplates: () => void;
  onOpenDebts: () => void;
  templateCount: number;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  data,
  onUpdateBaseline,
  onClearAll,
  triggerConfirm,
  triggerAlert,
  onOpenTemplates,
  onOpenDebts,
  templateCount,
}) => {
  const [baselineIncome, setBaselineIncome] = useState(data.baselineMonthlyIncome.toString());
  const [baselineBalance, setBaselineBalance] = useState(data.baselineBalance.toString());
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    setBaselineIncome(data.baselineMonthlyIncome.toString());
    setBaselineBalance(data.baselineBalance.toString());
  }, [data.baselineMonthlyIncome, data.baselineBalance]);

  const handleSave = (event: React.FormEvent) => {
    event.preventDefault();
    const income = Number.parseFloat(baselineIncome);
    const balance = Number.parseFloat(baselineBalance);
    if (!Number.isFinite(income) || income < 0 || !Number.isFinite(balance)) {
      triggerAlert("Check your entries", "Income must be zero or greater, and the balance must be a valid number.");
      return;
    }
    onUpdateBaseline(income, balance);
    setIsSaved(true);
    window.setTimeout(() => setIsSaved(false), 1800);
  };

  return (
    <div className="figma-settings mx-auto max-w-2xl space-y-3.5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-base font-semibold text-white">Debts</h2>
        <button onClick={onOpenDebts} className="figma-soft-button flex h-[38px] items-center gap-1.5 rounded-full px-3.5 text-[13px] text-white">
          <FigmaIcon name="add" size={14} /> Add Debts
        </button>
      </div>

      <button type="button" onClick={onOpenTemplates} className="figma-settings-link flex min-h-[68px] w-full items-center rounded-[30px] p-3.5 text-left">
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold leading-5 text-white">Templates</span>
          <span className="mt-1 block text-[11px] leading-[15px] text-white/40">{templateCount} active</span>
        </span>
        <FigmaIcon name="arrow-right-muted" size={16} className="opacity-50" />
      </button>

      <section className="figma-surface figma-settings-baseline rounded-[30px] p-3.5">
        <h3 className="border-b border-white/[0.09] pb-3.5 text-base font-semibold leading-5 text-white">Baseline</h3>
        <form onSubmit={handleSave} className="mt-3.5 space-y-3.5">
          <label className="block space-y-2.5">
            <span className="block text-[11px] leading-[15px] text-white/40">Monthly Income</span>
            <input type="number" required min="0" step="0.01" value={baselineIncome} onChange={event => setBaselineIncome(event.target.value)} className="figma-input h-11 w-full rounded-full px-3.5 text-[13px] font-semibold text-white outline-none" />
          </label>
          <label className="block space-y-2.5">
            <span className="block text-[11px] leading-[15px] text-white/40">Starting Balance</span>
            <input type="number" required step="0.01" value={baselineBalance} onChange={event => setBaselineBalance(event.target.value)} className="figma-input h-11 w-full rounded-full px-3.5 text-[13px] font-semibold text-white outline-none" />
          </label>
          <button type="submit" className="figma-soft-button h-11 w-full rounded-full text-[13px] font-semibold text-white">{isSaved ? "Saved" : "Save"}</button>
        </form>
      </section>

      <section className="figma-surface rounded-[30px] p-3.5">
        <h3 className="text-base font-semibold leading-5 text-white">Reset Data</h3>
        <button
          type="button"
          onClick={() => triggerConfirm("Clear data", "Delete all income, expenses, and baseline values? This action cannot be undone.", onClearAll)}
          className="figma-danger-button mt-3.5 h-11 w-full rounded-full text-[13px] font-semibold text-[#ff5050]"
        >Clear</button>
      </section>
    </div>
  );
};
