import React from "react";
import { ArrowRight, Check, ChevronDown, Coins, Plus, Trash2, X } from "lucide-react";
import { CalculatedMonth } from "../utils/calculations";

interface FutureViewProps {
  calculatedMonths: CalculatedMonth[];
  onSelectMonth: (monthStr: string) => void;
  onUpdateActualBalance: (monthStr: string, actualEndingBalance: number | null) => void;
  onNavigateToEditor: () => void;
  onAddMonth?: () => void;
  onDeleteMonth?: (monthStr: string) => void;
}

const formatCurrency = (value: number) => new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(value);

export const FutureView: React.FC<FutureViewProps> = ({
  calculatedMonths,
  onSelectMonth,
  onUpdateActualBalance,
  onNavigateToEditor,
  onAddMonth,
  onDeleteMonth,
}) => {
  const [expandedMonthStr, setExpandedMonthStr] = React.useState<string | null>(null);
  const [actualBalanceInput, setActualBalanceInput] = React.useState("");
  const currentMonth = calculatedMonths.find(month => month.isCurrent) ?? calculatedMonths[0];
  const summaryMonth = calculatedMonths.find(month => month.monthStr === expandedMonthStr) ?? currentMonth;

  React.useEffect(() => {
    if (expandedMonthStr && !calculatedMonths.some(month => month.monthStr === expandedMonthStr)) {
      setExpandedMonthStr(null);
    }
  }, [calculatedMonths, expandedMonthStr]);

  React.useEffect(() => {
    const expanded = calculatedMonths.find(month => month.monthStr === expandedMonthStr);
    if (expanded) setActualBalanceInput((expanded.actualEndingBalance ?? expanded.endingSavings).toString());
  }, [calculatedMonths, expandedMonthStr]);

  const toggleMonth = (monthStr: string) => {
    const next = expandedMonthStr === monthStr ? null : monthStr;
    setExpandedMonthStr(next);
    if (next) onSelectMonth(next);
  };

  const saveActualBalance = (monthStr: string) => {
    const value = Number.parseFloat(actualBalanceInput);
    if (Number.isFinite(value)) onUpdateActualBalance(monthStr, value);
  };

  return (
    <div className="figma-plans mx-auto max-w-3xl space-y-5">
      <section className="figma-surface figma-plans-summary rounded-[30px] p-3.5">
        <div className="flex items-center justify-between text-[13px] text-white/60">
          <span>{summaryMonth?.actualEndingBalance !== undefined ? "Actual end balance" : "End-of-month saving"}</span>
          <Coins size={20} strokeWidth={1.5} />
        </div>
        <p className="mt-5 text-[30px] font-extrabold leading-none text-white">{formatCurrency(summaryMonth?.endingSavings ?? 0)}</p>
      </section>

      <section className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold text-white">Cash flow</h2>
          {onAddMonth && (
            <button onClick={onAddMonth} className="figma-soft-button flex h-[38px] items-center gap-1.5 rounded-full px-3.5 text-[13px] text-white">
              <Plus size={15} strokeWidth={1.6} /> Add Month
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 items-start gap-2.5 md:grid-cols-2">
          {calculatedMonths.map(month => {
            const isExpanded = month.monthStr === expandedMonthStr;
            const positive = month.net >= 0;
            const savingsPositive = month.endingSavings >= 0;

            return (
              <article
                key={month.monthStr}
                className={`figma-month-card rounded-[30px] p-3.5 ${isExpanded ? "is-expanded" : ""}`}
              >
                <div className="flex min-h-[38px] w-full items-center gap-2.5">
                  <button type="button" onClick={() => toggleMonth(month.monthStr)} aria-expanded={isExpanded} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <span className="min-w-0 flex-1">
                      <span className={`text-[13px] font-bold ${month.isCurrent ? "text-[#29ff5e]" : "text-white"}`}>{month.monthName[0]}{month.monthName.slice(1).toLowerCase()}</span>
                      <span className="ml-1 text-[11px] font-normal text-white/35">‘{month.monthYear.slice(2)}</span>
                    </span>
                    {!isExpanded && (
                      <span className={`text-[13px] font-semibold ${savingsPositive ? "text-[#29ff5e]" : "text-[#ff5050]"}`}>{formatCurrency(month.endingSavings)}</span>
                    )}
                    <ChevronDown size={16} className={`shrink-0 text-white/40 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                  </button>
                  {!isExpanded && (
                    <span className="flex shrink-0 gap-2.5">
                      {calculatedMonths.length > 1 && onDeleteMonth && (
                        <button
                          type="button"
                          onClick={event => { event.stopPropagation(); onDeleteMonth(month.monthStr); }}
                          className="figma-icon-button text-[#ff5050]"
                          aria-label="Delete month"
                        ><Trash2 size={16} /></button>
                      )}
                      <button
                        type="button"
                        onClick={event => { event.stopPropagation(); onSelectMonth(month.monthStr); onNavigateToEditor(); }}
                        className="figma-icon-button text-white/70"
                        aria-label="Open monthly budget"
                      ><ArrowRight size={16} /></button>
                    </span>
                  )}
                </div>

                {isExpanded && (
                  <div className="mt-2.5 space-y-3 border-t border-white/[0.09] pt-3">
                    <div className="space-y-2 text-[11px]">
                      <div className="flex justify-between"><span className="text-white/45">Income</span><strong className="text-[13px] font-semibold text-[#29ff5e]">+{formatCurrency(month.income)}</strong></div>
                      <div className="flex justify-between"><span className="text-white/45">Expenses</span><strong className="text-[13px] font-semibold text-[#ff5050]">-{formatCurrency(month.totalExpenses)}</strong></div>
                      <div className="flex justify-between"><span className="text-white/45">Net</span><strong className={`text-[13px] font-semibold ${positive ? "text-[#29ff5e]" : "text-[#ff5050]"}`}>{positive ? "+" : ""}{formatCurrency(month.net)}</strong></div>
                    </div>

                    <form
                      onSubmit={event => { event.preventDefault(); saveActualBalance(month.monthStr); }}
                      className="space-y-2.5 border-t border-white/[0.09] pt-3"
                    >
                      <label className="block text-[11px] text-white/45">Actual Balance</label>
                      <div className="flex gap-2.5">
                        <input
                          type="number"
                          step="0.01"
                          value={actualBalanceInput}
                          onChange={event => setActualBalanceInput(event.target.value)}
                          className="figma-input h-[38px] min-w-0 flex-1 rounded-full px-3.5 text-[13px] font-semibold text-white outline-none"
                        />
                        {month.actualEndingBalance !== undefined && (
                          <button
                            type="button"
                            onClick={() => { onUpdateActualBalance(month.monthStr, null); setActualBalanceInput(month.projectedEndingSavings.toString()); }}
                            className="figma-icon-button text-white/60"
                            aria-label="Use calculated balance"
                          ><X size={15} /></button>
                        )}
                        <button type="submit" className="figma-icon-button is-primary text-white" aria-label="Save actual balance"><Check size={19} /></button>
                      </div>
                    </form>

                    <div className="flex items-end justify-between border-t border-white/[0.09] pt-3">
                      <div>
                        <p className="text-[11px] text-white/45">Saving</p>
                        <p className={`mt-1 text-base font-semibold ${savingsPositive ? "text-white" : "text-[#ff5050]"}`}>{formatCurrency(month.endingSavings)}</p>
                      </div>
                      <div className="flex gap-2.5">
                        {calculatedMonths.length > 1 && onDeleteMonth && (
                          <button onClick={() => onDeleteMonth(month.monthStr)} className="figma-icon-button text-[#ff5050]" aria-label="Delete month"><Trash2 size={16} /></button>
                        )}
                        <button onClick={() => { onSelectMonth(month.monthStr); onNavigateToEditor(); }} className="figma-icon-button text-white/70" aria-label="Open monthly budget"><ArrowRight size={16} /></button>
                      </div>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
};
