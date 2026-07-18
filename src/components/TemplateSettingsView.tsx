import React, { useEffect, useState } from "react";
import { ArrowLeft, Check, RotateCcw, Trash2 } from "lucide-react";
import { ExpenseTemplate, ExpenseTemplateOverride } from "../types";

const EXPENSE_CATEGORIES = ["Housing", "Living", "Entertainment", "Subscriptions", "Transport", "Debt", "Other"];

interface TemplateSettingsViewProps {
  templates: ExpenseTemplate[];
  overrides: ExpenseTemplateOverride[];
  onBack: () => void;
  onSave: (templateId: string, override: ExpenseTemplateOverride) => void;
  onReset: (templateId: string) => void;
  onDelete: (templateId: string) => void;
  onRestore: (templateId: string) => void;
  triggerConfirm: (title: string, message: string, onConfirm: () => void) => void;
  triggerAlert: (title: string, message: string) => void;
}

interface TemplateEditorProps {
  template: ExpenseTemplate;
  hasOverride: boolean;
  onSave: TemplateSettingsViewProps["onSave"];
  onReset: TemplateSettingsViewProps["onReset"];
  onDelete: TemplateSettingsViewProps["onDelete"];
  triggerConfirm: TemplateSettingsViewProps["triggerConfirm"];
  triggerAlert: TemplateSettingsViewProps["triggerAlert"];
}

const TemplateEditor: React.FC<TemplateEditorProps> = ({ template, hasOverride, onSave, onReset, onDelete, triggerConfirm, triggerAlert }) => {
  const [title, setTitle] = useState(template.title);
  const [category, setCategory] = useState(template.category);
  const [amount, setAmount] = useState(template.amount?.toString() ?? "");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setTitle(template.title);
    setCategory(template.category);
    setAmount(template.amount?.toString() ?? "");
  }, [template]);

  const handleSave = (event: React.FormEvent) => {
    event.preventDefault();
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

  return (
    <form onSubmit={handleSave} className="liquid-glass overflow-hidden rounded-[2rem]">
      <div className="flex items-center gap-3 border-b border-white/[0.07] px-4 py-3.5 md:px-5">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-extrabold text-white">{template.title}</h3>
          <span className={`text-[9px] font-black uppercase tracking-[0.16em] ${template.source === "debt" ? "text-rose-300/70" : "text-emerald-300/70"}`}>
            {template.source === "debt" ? "Debt template" : "Recurring template"}
          </span>
        </div>
        <button
          type="button"
          onClick={() => triggerConfirm("Delete template", `Remove “${template.title}” from your templates?`, () => onDelete(template.id))}
          aria-label={`Delete ${template.title}`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-rose-400/15 bg-rose-400/[0.07] text-rose-300 transition hover:bg-rose-400/15"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div className="grid gap-3 p-4 md:grid-cols-2 md:p-5">
        <label className="space-y-1.5 md:col-span-2">
          <span className="pl-3 text-[9px] font-bold uppercase tracking-widest text-white/35">Title</span>
          <input
            value={title}
            onChange={event => setTitle(event.target.value)}
            disabled={template.source === "debt"}
            className="liquid-input min-h-12 w-full rounded-full border px-4 text-sm font-semibold text-white outline-none disabled:cursor-not-allowed disabled:opacity-50"
          />
        </label>

        <label className="space-y-1.5">
          <span className="pl-3 text-[9px] font-bold uppercase tracking-widest text-white/35">Category</span>
          <select
            value={category}
            onChange={event => setCategory(event.target.value)}
            disabled={template.source === "debt"}
            className="liquid-input min-h-12 w-full rounded-full border px-4 text-sm font-semibold text-white outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            {[...new Set([...EXPENSE_CATEGORIES, category])].map(option => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="pl-3 text-[9px] font-bold uppercase tracking-widest text-white/35">Amount ($)</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            inputMode="decimal"
            value={amount}
            onChange={event => setAmount(event.target.value)}
            placeholder="Optional"
            className="liquid-input min-h-12 w-full rounded-full border px-4 text-sm font-semibold text-white outline-none"
          />
        </label>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-white/[0.07] px-4 py-3.5 md:px-5">
        {hasOverride && (
          <button type="button" onClick={() => onReset(template.id)} className="flex min-h-11 items-center gap-1.5 rounded-full border border-white/[0.09] px-4 text-[10px] font-bold text-white/55 transition hover:text-white">
            <RotateCcw size={13} /> Reset
          </button>
        )}
        <button type="submit" className="flex min-h-11 min-w-24 items-center justify-center gap-2 rounded-full bg-emerald-400 px-5 text-xs font-black text-slate-950 transition hover:bg-emerald-300">
          {saved && <Check size={14} />} {saved ? "Saved" : "Save"}
        </button>
      </div>
    </form>
  );
};

export const TemplateSettingsView: React.FC<TemplateSettingsViewProps> = ({ templates, overrides, onBack, onSave, onReset, onDelete, onRestore, triggerConfirm, triggerAlert }) => {
  const overridesById = new Map<string, ExpenseTemplateOverride>(
    overrides.map(override => [override.templateId, override] as [string, ExpenseTemplateOverride])
  );
  const activeTemplates = templates.filter(template => !overridesById.get(template.id)?.hidden);
  const deletedTemplates = templates.filter(template => overridesById.get(template.id)?.hidden);

  return (
    <div className="max-w-3xl space-y-5 md:space-y-6">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onBack} aria-label="Back to settings" className="liquid-glass flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/70 transition hover:text-white">
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xl font-black uppercase tracking-tight text-white">Expense Templates</h2>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">{activeTemplates.length} active</p>
        </div>
      </div>

      {activeTemplates.length > 0 ? (
        <div className="space-y-3">
          {activeTemplates.map(template => (
            <TemplateEditor
              key={template.id}
              template={template}
              hasOverride={overridesById.has(template.id)}
              onSave={onSave}
              onReset={onReset}
              onDelete={onDelete}
              triggerConfirm={triggerConfirm}
              triggerAlert={triggerAlert}
            />
          ))}
        </div>
      ) : (
        <div className="liquid-glass rounded-[2rem] px-5 py-10 text-center text-xs font-semibold text-white/40">No active templates</div>
      )}

      {deletedTemplates.length > 0 && (
        <section className="space-y-2 pt-2">
          <h3 className="px-2 text-[9px] font-black uppercase tracking-widest text-white/30">Deleted</h3>
          {deletedTemplates.map(template => (
            <div key={template.id} className="flex min-h-16 items-center gap-3 rounded-full border border-white/[0.07] bg-white/[0.025] px-4 py-2.5">
              <span className="min-w-0 flex-1 truncate text-xs font-bold text-white/45">{template.title}</span>
              <button type="button" onClick={() => onRestore(template.id)} className="min-h-10 shrink-0 rounded-full border border-white/[0.09] px-4 text-[10px] font-bold text-white/65 transition hover:text-white">Restore</button>
            </div>
          ))}
        </section>
      )}
    </div>
  );
};
