import React, { useEffect, useState } from "react";
import { HandCoins, Plus, Trash2, X } from "lucide-react";
import { DebtItem } from "../types";

interface DebtViewProps {
  debts: DebtItem[];
  onAddDebt: (name: string, totalAmount: number) => void;
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
  onDeleteDebt,
  triggerConfirm,
  triggerAlert,
}) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
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
    setName("");
    setAmount("");
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
    if (debts.some(debt => normalizeTitle(debt.name) === normalizeTitle(cleanName))) {
      triggerAlert("Debt already exists", "Use a unique title for each debt.");
      return;
    }
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      triggerAlert("Check the amount", "Enter an amount greater than zero.");
      return;
    }

    onAddDebt(cleanName, totalAmount);
    setIsFormOpen(false);
  };

  const outstandingTotal = debts.reduce((sum, debt) => {
    const paid = debt.payments.reduce((paymentSum, payment) => paymentSum + payment.amount, 0);
    return sum + Math.max(debt.totalAmount - paid, 0);
  }, 0);

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-black uppercase tracking-tight text-white">Debts</h2>
          <p className="mt-1 text-[11px] text-white/40">Outstanding: {formatCurrency(outstandingTotal)}</p>
        </div>
        <button
          onClick={openForm}
          className="flex min-h-11 items-center gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 text-xs font-bold text-rose-300 transition hover:bg-rose-500/15 active:scale-95"
        >
          <Plus size={15} /> Add debt
        </button>
      </div>

      <div className="liquid-glass rounded-[2rem] p-4 md:p-5">
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.06] p-3.5">
          <HandCoins size={17} className="mt-0.5 shrink-0 text-emerald-400" />
          <div>
            <p className="text-[11px] font-bold text-white/85">Payments are linked automatically</p>
            <p className="mt-1 text-[10px] leading-relaxed text-white/40">
              Add an expense with category Debt and the exact same Title. Marking it paid reduces this balance; unmarking it restores the balance.
            </p>
          </div>
        </div>

        {debts.length === 0 ? (
          <div className="rounded-3xl border border-white/[0.05] bg-black/10 px-5 py-12 text-center">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.03] text-white/25">
              <HandCoins size={19} />
            </div>
            <p className="text-xs font-bold text-white/55">No debts added yet</p>
            <p className="mt-1 text-[10px] text-white/25">Add a debt, then pay it through your expense list.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {debts.map(debt => {
              const paid = debt.payments.reduce((sum, payment) => sum + payment.amount, 0);
              const remaining = Math.max(debt.totalAmount - paid, 0);
              const progress = Math.min((paid / debt.totalAmount) * 100, 100);
              const isPaid = remaining <= 0.005;

              return (
                <article
                  key={debt.id}
                  className={`rounded-3xl border p-4 ${isPaid ? "border-emerald-500/15 bg-emerald-500/[0.06]" : "border-rose-500/15 bg-rose-500/[0.06]"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-bold text-white/95">{debt.name}</h3>
                      <p className="mt-1 text-[9px] text-white/35">Paid {formatCurrency(paid)} of {formatCurrency(debt.totalAmount)}</p>
                    </div>
                    <button
                      onClick={() => triggerConfirm(
                        "Delete debt",
                        `Delete “${debt.name}” and its linked payment history?`,
                        () => onDeleteDebt(debt.id)
                      )}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-white/30 transition hover:border-rose-500/20 hover:bg-rose-500/10 hover:text-rose-300"
                      title="Delete debt"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  <div className="mt-5 flex items-end justify-between gap-3">
                    <div>
                      <p className={`text-xl font-black ${isPaid ? "text-emerald-400" : "text-rose-300"}`}>{formatCurrency(remaining)}</p>
                      <p className="text-[8px] font-bold uppercase tracking-widest text-white/30">{isPaid ? "Paid off" : "Remaining"}</p>
                    </div>
                    <span className="text-[10px] font-bold text-white/35">{Math.round(progress)}%</span>
                  </div>

                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/25">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${isPaid ? "bg-emerald-400" : "bg-gradient-to-r from-rose-500 to-amber-400"}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {isFormOpen && (
        <div
          className="app-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md animate-fadeIn"
          onMouseDown={event => {
            if (event.target === event.currentTarget) setIsFormOpen(false);
          }}
        >
          <form onSubmit={handleSubmit} className="liquid-glass-strong w-full max-w-sm rounded-[2rem] border border-white/[0.09] p-5 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-rose-300/70">Debt tracker</p>
                <h3 className="mt-1 text-lg font-black text-white">Add a debt</h3>
              </div>
              <button type="button" onClick={() => setIsFormOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.04] text-white/50" aria-label="Close">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Debt title</label>
                <input value={name} onChange={event => setName(event.target.value)} placeholder="For example, Debt to Amal" className="w-full rounded-2xl border border-white/[0.08] bg-black/40 px-4 py-3 text-sm text-white outline-none placeholder:text-white/20 focus:border-rose-500/40" autoFocus />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Total debt, USD</label>
                <input type="number" min="0.01" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} placeholder="0.00" className="w-full rounded-2xl border border-white/[0.08] bg-black/40 px-4 py-3 text-lg font-bold text-white outline-none placeholder:text-white/20 focus:border-emerald-500/40" />
              </div>
            </div>

            <button type="submit" className="mt-5 min-h-12 w-full rounded-2xl border border-emerald-400/20 bg-emerald-500 font-bold text-slate-950 transition hover:bg-emerald-400 active:scale-[0.98]">
              Save debt
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
