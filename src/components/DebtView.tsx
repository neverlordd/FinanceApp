import React, { useEffect, useState } from "react";
import { HandCoins, X } from "lucide-react";
import { DebtItem } from "../types";
import { FigmaIcon } from "./FigmaIcon";

interface DebtViewProps {
  debts: DebtItem[];
  onAddDebt: (name: string, totalAmount: number) => void;
  onEditDebt: (debtId: string, name: string, totalAmount: number) => void;
  onDeleteDebt: (debtId: string) => void;
  triggerConfirm: (title: string, message: string, onConfirm: () => void) => void;
  triggerAlert: (title: string, message: string) => void;
}

const formatCurrency = (value: number) => new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(value);

const normalizeTitle = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase();

export const DebtView: React.FC<DebtViewProps> = ({
  debts,
  onAddDebt,
  onEditDebt,
  onDeleteDebt,
  triggerConfirm,
  triggerAlert,
}) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDebtId, setEditingDebtId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");

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

  const openForm = () => {
    setEditingDebtId(null);
    setName("");
    setAmount("");
    setIsFormOpen(true);
  };

  const openEditForm = (debt: DebtItem) => {
    setEditingDebtId(debt.id);
    setName(debt.name);
    setAmount(debt.totalAmount.toFixed(2));
    setIsFormOpen(true);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const cleanName = name.trim().replace(/\s+/g, " ");
    const totalAmount = Number(Number.parseFloat(amount).toFixed(2));

    if (!cleanName) {
      triggerAlert("Check the name", "Enter the same title you will use for Debt expenses.");
      return;
    }
    if (debts.some(debt => debt.id !== editingDebtId && normalizeTitle(debt.name) === normalizeTitle(cleanName))) {
      triggerAlert("Debt already exists", "Use a unique title for each debt.");
      return;
    }
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      triggerAlert("Check the amount", "Enter an amount greater than zero.");
      return;
    }

    if (editingDebtId) onEditDebt(editingDebtId, cleanName, totalAmount);
    else onAddDebt(cleanName, totalAmount);
    setIsFormOpen(false);
  };

  return (
    <div className="figma-debts mx-auto max-w-3xl space-y-3.5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-base font-semibold text-white">Debts</h2>
        <button
          onClick={openForm}
          className="figma-soft-button flex h-[38px] items-center gap-1.5 rounded-full px-3.5 text-[13px] text-white"
        >
          <FigmaIcon name="add" size={14} /> Add Debts
        </button>
      </div>

      {debts.length === 0 ? (
          <div className="figma-surface rounded-[30px] px-5 py-12 text-center">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.03] text-white/25">
              <HandCoins size={19} />
            </div>
            <p className="text-xs font-bold text-white/55">No debts added yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3">
            {debts.map(debt => {
              const paid = debt.payments.reduce((sum, payment) => sum + payment.amount, 0);
              const remaining = Math.max(debt.totalAmount - paid, 0);
              const progress = Math.min((paid / debt.totalAmount) * 100, 100);
              const isPaid = remaining <= 0.005;

              return (
                <article
                  key={debt.id}
                  className="figma-debt-card rounded-[30px] p-3.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-normal text-white">{debt.name}</h3>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        onClick={() => openEditForm(debt)}
                        className="figma-icon-button text-white/50 transition hover:text-white"
                        aria-label={`Edit ${debt.name}`}
                      >
                        <FigmaIcon name="edit-2" size={16} className="opacity-65" />
                      </button>
                      <button
                        onClick={() => triggerConfirm(
                          "Delete debt",
                          `Delete “${debt.name}” and its linked payment history?`,
                          () => onDeleteDebt(debt.id)
                        )}
                        className="figma-icon-button text-white/45 transition hover:text-[#ff5050]"
                        aria-label={`Delete ${debt.name}`}
                      >
                        <FigmaIcon name="trash-muted" size={16} className="opacity-50" />
                      </button>
                    </div>
                  </div>

                  <p className={`mt-3 text-2xl font-extrabold ${isPaid ? "text-[#29ff5e]" : "text-[#ff5050]"}`}>{formatCurrency(remaining)}</p>

                  <div className="mt-3.5 flex items-center justify-between text-[11px]">
                    <span className="text-white/35">{formatCurrency(paid)}</span>
                    <span className="text-white">{Math.round(progress)}%</span>
                    <span className="text-white/35">{formatCurrency(debt.totalAmount)}</span>
                  </div>

                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#07ffe1] to-[#ffe500] transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        )}

      {isFormOpen && (
        <div
          className="app-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md animate-fadeIn"
          onMouseDown={event => {
            if (event.target === event.currentTarget) setIsFormOpen(false);
          }}
        >
          <form onSubmit={handleSubmit} className="debt-modal liquid-glass-strong w-full max-w-sm p-5 shadow-2xl">
            <div className="mb-5 flex items-center justify-between gap-4">
              <h3 className="text-base font-semibold text-white">{editingDebtId ? "Edit debt" : "Add debt"}</h3>
              <button type="button" onClick={() => setIsFormOpen(false)} className="figma-icon-button text-white/50" aria-label="Close">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3.5">
              <div className="space-y-2.5">
                <label htmlFor="debt-title" className="text-[11px] text-white/45">Title</label>
                <input id="debt-title" value={name} onChange={event => setName(event.target.value)} className="figma-input h-11 w-full px-4 text-sm text-white outline-none" autoFocus />
              </div>
              <div className="space-y-2.5">
                <label htmlFor="debt-amount" className="text-[11px] text-white/45">Amount, USD</label>
                <input id="debt-amount" type="number" min="0.01" step="0.01" inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} className="figma-input h-11 w-full px-4 text-sm font-semibold text-white outline-none" />
              </div>
            </div>

            <button type="submit" className="figma-soft-button is-primary mt-5 min-h-11 w-full text-[13px] font-semibold text-white transition active:scale-[0.98]">
              Save debt
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
