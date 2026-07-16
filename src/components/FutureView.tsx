import React from "react";
import { CalculatedMonth } from "../utils/calculations";
import {
  Calendar,
  Wallet,
  ArrowRight,
  Plus,
  Trash2
} from "lucide-react";

interface FutureViewProps {
  calculatedMonths: CalculatedMonth[];
  selectedMonthStr: string;
  onSelectMonth: (monthStr: string) => void;
  onNavigateToEditor: () => void;
  onAddMonth?: () => void;
  onDeleteMonth?: (monthStr: string) => void;
}

export const FutureView: React.FC<FutureViewProps> = ({
  calculatedMonths,
  selectedMonthStr,
  onSelectMonth,
  onNavigateToEditor,
  onAddMonth,
  onDeleteMonth
}) => {
  // Find currently selected month stats for the executive summary at the top
  const selectedMonthObj = calculatedMonths.find(m => m.monthStr === selectedMonthStr) || calculatedMonths[calculatedMonths.length - 1];

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2
    }).format(val);
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight uppercase">Savings & Statistics</h2>
        </div>
        <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
          {onAddMonth && (
            <button
              onClick={onAddMonth}
              className="mobile-primary-action px-3 sm:px-4 py-2.5 text-xs font-bold bg-emerald-500/10 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/35 transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <Plus size={16} strokeWidth={3} />
              <span>Add Month</span>
            </button>
          )}
          {calculatedMonths.length > 1 && onDeleteMonth && (
            <button
              onClick={() => onDeleteMonth(selectedMonthStr)}
              className="mobile-primary-action text-xs font-bold text-rose-400 hover:text-rose-300 transition-all flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 hover:border-rose-500/30 cursor-pointer active:scale-95"
            >
              <Trash2 size={16} strokeWidth={2.5} />
              <span>Delete Month</span>
            </button>
          )}
        </div>
      </div>

      {/* EXECUTIVE SUMMARY AT THE TOP: Cumulative Savings card (full-width, clean, no description) */}
      <div className="grid grid-cols-1 gap-5">

        {/* KPI: Cumulative Savings (Moved from Dashboard, positioned at the top) */}
        <div className="liquid-glass-strong rounded-3xl p-6 relative overflow-hidden flex flex-col justify-between group hover:border-emerald-500/30 transition-all duration-300">
          <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-emerald-500/15 transition-all duration-300" />

          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-white/40 tracking-wider uppercase">End-of-Month Savings</span>
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
                <Wallet size={18} strokeWidth={2.2} />
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="text-3xl font-black text-white tracking-tight font-sans">
                {formatCurrency(selectedMonthObj?.endingSavings ?? 0)}
              </h3>
            </div>
          </div>
        </div>
      </div>

      {/* MONTHLY BREAKDOWN BENTO BLOCKS */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider flex items-center gap-1.5">
            <Calendar size={13} className="text-emerald-400" />
            Cash Flow & Forecast
          </h3>
        </div>

        {/* Dynamic Bento Block Display */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          {calculatedMonths.map((month) => {
            const isSelected = month.monthStr === selectedMonthStr;
            const netPositive = month.net >= 0;
            return (
              <div
                key={month.monthStr}
                onClick={() => {
                  onSelectMonth(month.monthStr);
                }}
                className={`group transition-all duration-300 relative overflow-hidden flex flex-col justify-between ${
                  isSelected
                    ? "liquid-glass-strong p-5 rounded-3xl border-emerald-500/40 shadow-[0_16px_36px_rgba(16,185,129,0.12)] scale-[1.01]"
                    : "liquid-glass p-3.5 rounded-2xl hover:border-white/[0.2] cursor-pointer"
                }`}
              >
                {/* Visual Accent Glow on selection */}
                {isSelected && (
                  <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
                )}

                {!isSelected ? (
                  /* Collapsed Card Layout for inactive months */
                  <div className="flex items-center justify-between w-full gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      {month.isCurrent && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0 shadow-[0_0_8px_#10b981]" />
                      )}
                      <h4 className="text-xs font-black tracking-tight text-white/90 truncate">
                        {month.monthName} <span className="text-[9px] text-white/30 font-mono font-medium">'{month.monthYear.slice(2)}</span>
                      </h4>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {/* Savings */}
                      <div className="text-right">
                        <span className="text-[7px] uppercase tracking-wider font-bold text-white/30 block leading-none mb-0.5">Savings</span>
                        <span className={`text-[11px] font-bold font-mono tracking-tight ${month.endingSavings >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          {formatCurrency(month.endingSavings)}
                        </span>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1">
                        {calculatedMonths.length > 1 && onDeleteMonth && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteMonth(month.monthStr);
                            }}
                            className="plan-icon-button bg-rose-500/5 hover:bg-rose-500/20 border border-rose-500/10 hover:border-rose-500/25 text-rose-400/80 hover:text-rose-400 transition-all cursor-pointer"
                            title="Delete month"
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectMonth(month.monthStr);
                            onNavigateToEditor();
                          }}
                          className="plan-icon-button border bg-white/[0.03] border-white/[0.05] hover:bg-white/[0.1] text-white/50 hover:text-white transition-all cursor-pointer"
                          title="Open monthly budget"
                        >
                          <ArrowRight size={11} strokeWidth={2.5} />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Expanded Card Layout for the active selected month */
                  <>
                    {/* Block Header */}
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/[0.04]">
                      <div className="flex items-center gap-2">
                        {month.isCurrent && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]" />
                        )}
                        <h4 className="text-sm font-black tracking-tight text-emerald-400">
                          {month.monthName} <span className="text-[10px] text-white/30 font-mono font-medium">'{month.monthYear.slice(2)}</span>
                        </h4>
                      </div>

                      {/* Status indicator pill */}
                      <span className={`text-[8px] font-mono font-extrabold px-1.5 py-0.5 rounded ${netPositive ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                        {netPositive ? "SURPLUS" : "DEFICIT"}
                      </span>
                    </div>

                    {/* Stats Breakdown */}
                    <div className="space-y-2 text-xs font-mono">
                      {/* Income row */}
                      <div className="flex items-center justify-between text-white/50">
                        <span className="text-[10px] uppercase font-bold tracking-wider">Income:</span>
                        <span className="text-emerald-400 font-bold">+{formatCurrency(month.income)}</span>
                      </div>

                      {/* Expenses row */}
                      <div className="flex items-center justify-between text-white/50">
                        <span className="text-[10px] uppercase font-bold tracking-wider">Expenses:</span>
                        <span className="text-rose-400/90 font-bold">-{formatCurrency(month.totalExpenses)}</span>
                      </div>

                      {/* Leftover row */}
                      <div className="flex items-center justify-between pt-1 border-t border-white/[0.03]">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-white/40">Net:</span>
                        <span className={`font-bold ${netPositive ? "text-emerald-400" : "text-rose-400"}`}>
                          {netPositive ? "+" : ""}{formatCurrency(month.net)}
                        </span>
                      </div>
                    </div>

                    {/* Savings Goal Progress Summary */}
                    <div className="mt-4 pt-3 border-t border-white/[0.04] flex items-end justify-between">
                      <div className="space-y-0.5">
                        <p className="text-[8px] uppercase tracking-wider font-bold text-white/30">Savings</p>
                        <p className={`text-sm font-bold font-mono tracking-tight ${month.endingSavings >= 0 ? "text-white" : "text-rose-400"}`}>
                          {formatCurrency(month.endingSavings)}
                        </p>
                      </div>

                      {/* View details and delete buttons */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {calculatedMonths.length > 1 && onDeleteMonth && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteMonth(month.monthStr);
                            }}
                            className="plan-icon-button bg-rose-500/5 hover:bg-rose-500/20 border border-rose-500/10 hover:border-rose-500/20 text-rose-400 transition-all cursor-pointer"
                            title="Delete month"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectMonth(month.monthStr);
                            onNavigateToEditor();
                          }}
                          className="plan-icon-button border transition-all duration-150 cursor-pointer bg-emerald-500 text-slate-950 border-transparent hover:bg-emerald-400"
                          title="Open monthly budget"
                        >
                          <ArrowRight size={12} strokeWidth={2.5} />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
