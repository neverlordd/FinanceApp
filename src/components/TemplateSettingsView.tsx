import React, { useEffect, useState } from "react";
import { ArrowLeft, Check, RotateCcw } from "lucide-react";
import { ExpenseTemplate, ExpenseTemplateOverride } from "../types";

const EXPENSE_CATEGORIES = ["Housing", "Living", "Transport", "Entertainment", "Health", "Education", "Debt", "Subscriptions", "Other"];

interface TemplateSettingsViewProps {
  templates: ExpenseTemplate[];
  overrides: ExpenseTemplateOverride[];
  onBack: () => void;
  onSave: (templateId: string, override: ExpenseTemplateOverride) => void;
  onReset: (templateId: string) => void;
  triggerAlert: (title: string, message: string) => void;
}

interface TemplateEditorProps {
  template: ExpenseTemplate;
  hasOverride: boolean;
  onSave: TemplateSettingsViewProps["onSave"];
  onReset: TemplateSettingsViewProps["onReset"];
  triggerAlert: TemplateSettingsViewProps["triggerAlert"];
}

const TemplateEditor: React.FC<TemplateEditorProps> = ({ template, hasOverride, onSave, onReset, triggerAlert }) => {
  const [title, setTitle] = useState(template.title);
  const [category, setCategory] = useState(template.category);
  const [amount, setAmount] = useState(template.amount?.toString() ?? "");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setTitle(template.title);
    setCategory(template.category);
    setAmount(template.amount?.toString() ?? "");
  }, [template]);

  const handleSave = () => {
    const cleanTitle = title.trim();
    const parsedAmount = amount.trim() === "" ? null : Number(amount);
    if (!cleanTitle || (parsedAmount !== null && (!Number.isFinite(parsedAmount) || parsedAmount <= 0))) {
      triggerAlert("Check template", "Enter a title and a valid amount.");
      return;
    }

    onSave(template.id, {
      templateId: template.id,
      title: template.source === "recurring" ? cleanTitle : undefined,
      category: template.source === "recurring" ? category : undefined,
      amount: parsedAmount,
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  const handleReset = () => {
    onReset(template.id);
    setSaved(false);
  };

  return (
    <article className="liquid-glass rounded-3xl p-4 md:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className={`rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest ${template.source === "debt" ? "bg-rose-400/12 text-rose-300" : "bg-emerald-400/12 text-emerald-300"}`}>
          {template.source === "debt" ? "Debt" : "Recurring"}
        </span>
        {hasOverride && (
          <button type="button" onClick={handleReset} className="flex min-h-10 items-center gap-1.5 rounded-full border border-white/[0.08] px-3 text-[10px] font-bold text-white/55 transition hover:text-white">
            <RotateCcw size={13} /> Reset
          </button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(110px,.7fr)]">
        <label className="space-y-1.5">
          <span className="pl-2 text-[9px] font-bold uppercase tracking-widest text-white/35">Title</span>
          <input
            value={title}
            onChange={event => setTitle(event.target.value)}
            disabled={template.source === "debt"}
            className="liquid-input min-h-12 w-full rounded-full border px-4 text-xs font-semibold text-white outline-none disabled:cursor-not-allowed disabled:opacity-55"
          />
        </label>

        <label className="space-y-1.5">
          <span className="pl-2 text-[9px] font-bold uppercase tracking-widest text-white/35">Category</span>
          <select
            value={category}
            onChange={event => setCategory(event.target.value)}
            disabled={template.source === "debt"}
            className="liquid-input min-h-12 w-full rounded-full border px-4 text-xs font-semibold text-white outline-none disabled:cursor-not-allowed disabled:opacity-55"
          >
            {[...new Set([...EXPENSE_CATEGORIES, category])].map(option => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="pl-2 text-[9px] font-bold uppercase tracking-widest text-white/35">Amount ($)</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            inputMode="decimal"
            value={amount}
            onChange={event => setAmount(event.target.value)}
            placeholder="Optional"
            className="liquid-input min-h-12 w-full rounded-full border px-4 text-xs font-semibold text-white outline-none"
          />
        </label>
      </div>

      <div className="mt-4 flex justify-end">
        <button type="button" onClick={handleSave} className="flex min-h-11 items-center gap-2 rounded-full bg-emerald-400 px-5 text-xs font-black text-slate-950 transition hover:bg-emerald-300">
          {saved && <Check size={14} />} {saved ? "Saved" : "Save"}
        </button>
      </div>
    </article>
  );
};

export const TemplateSettingsView: React.FC<TemplateSettingsViewProps> = ({ templates, overrides, onBack, onSave, onReset, triggerAlert }) => {
  const overriddenIds = new Set(overrides.map(override => override.templateId));

  return (
    <div className="max-w-3xl space-y-5 md:space-y-6">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onBack} aria-label="Back to settings" className="liquid-glass flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/70 transition hover:text-white">
          <ArrowLeft size={18} />
        </button>
        <h2 className="text-xl font-black uppercase tracking-tight text-white">Expense Templates</h2>
      </div>

      {templates.length > 0 ? (
        <div className="space-y-3">
          {templates.map(template => (
            <TemplateEditor
              key={template.id}
              template={template}
              hasOverride={overriddenIds.has(template.id)}
              onSave={onSave}
              onReset={onReset}
              triggerAlert={triggerAlert}
            />
          ))}
        </div>
      ) : (
        <div className="liquid-glass rounded-3xl px-5 py-10 text-center text-xs font-semibold text-white/40">No templates yet</div>
      )}
    </div>
  );
};
