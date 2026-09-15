import React, { useEffect, useState } from "react";
import { FinanceData } from "../types";
import { Moon, Sun } from "lucide-react";
import { FigmaIcon } from "./FigmaIcon";

interface SettingsViewProps {
  data: FinanceData;
  onUpdateBaseline: (baselineMonthlyIncome: number, baselineBalance: number) => void;
  onClearAll: () => void;
  triggerConfirm: (title: string, message: string, onConfirm: () => void) => void;
  triggerAlert: (title: string, message: string) => void;
  onOpenTemplates: () => void;
  templateCount: number;
  theme: "light" | "dark";
  onThemeChange: (theme: "light" | "dark") => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  data,
  onUpdateBaseline,
  onClearAll,
  triggerConfirm,
  triggerAlert,
  onOpenTemplates,
  templateCount,
  theme,
  onThemeChange,
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
    <div className="figma-settings mx-auto max-w-3xl space-y-3.5">
      <div className="ios-page-heading">
        <span>Preferences</span>
        <h1>Settings</h1>
      </div>
      <button type="button" onClick={onOpenTemplates} className="figma-settings-link flex h-[38px] min-h-[38px] w-full items-center rounded-full px-3.5 text-left">
        <span className="min-w-0 flex-1 text-[11px] font-normal text-white/60">Templates</span>
        <span className="flex shrink-0 items-center gap-2 text-[9px] font-semibold text-white/35">
          {templateCount} active
          <FigmaIcon name="arrow-right-muted" size={16} className="opacity-50" />
        </span>
      </button>

      <section className="figma-surface appearance-card rounded-[30px] p-3.5">
        <div className="mb-3 flex items-center justify-between px-1">
          <div>
            <h3 className="text-base font-semibold leading-5 text-white">Appearance</h3>
            <p className="mt-1 text-[11px] text-white/40">Choose how the app looks</p>
          </div>
          <span className="appearance-icon flex h-9 w-9 items-center justify-center rounded-full text-white/60">
            {theme === "light" ? <Sun size={16} /> : <Moon size={16} />}
          </span>
        </div>
        <div className="theme-segmented grid grid-cols-2 gap-1 rounded-full p-1" role="group" aria-label="Color theme">
          <button
            type="button"
            onClick={() => onThemeChange("light")}
            aria-pressed={theme === "light"}
            className="flex h-10 items-center justify-center gap-2 rounded-full text-[12px] font-semibold"
          >
            <Sun size={15} /> Light
          </button>
          <button
            type="button"
            onClick={() => onThemeChange("dark")}
            aria-pressed={theme === "dark"}
            className="flex h-10 items-center justify-center gap-2 rounded-full text-[12px] font-semibold"
          >
            <Moon size={15} /> Dark
          </button>
        </div>
      </section>

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
