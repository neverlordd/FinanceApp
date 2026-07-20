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
    <form onSubmit={handleSave} className="figma-surface rounded-[30px] p-3.5 md:p-4">
      <div className="mb-3 flex items-center gap-3">
        <span className={`min-w-0 flex-1 truncate text-[9px] font-black uppercase tracking-[0.16em] ${template.source === "debt" ? "text-rose-300/70" : "text-emerald-300/70"}`}>
          {template.source === "debt" ? "Debt template" : "Recurring template"}
        </span>
        <button
          type="button"
          onClick={() => triggerConfirm("Delete template", `Remove “${template.title}” from your templates?`, () => onDelete(template.id))}
          aria-label={`Delete ${template.title}`}
          className="figma-icon-button shrink-0 text-[#ff5050]"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
        <label className="col-span-2 space-y-1 md:col-span-1">
          <span className="pl-3 text-[9px] font-bold uppercase tracking-widest text-white/35">Title</span>
          <input
            value={title}
            onChange={event => setTitle(event.target.value)}
            disabled={template.source === "debt"}
            className="figma-input min-h-11 w-full rounded-full px-3.5 text-xs font-semibold text-white outline-none disabled:cursor-not-allowed disabled:opacity-50"
          />
        </label>

        <label className="space-y-1">
          <span className="pl-3 text-[9px] font-bold uppercase tracking-widest text-white/35">Category</span>
          <select
            value={category}
            onChange={event => setCategory(event.target.value)}
            disabled={template.source === "debt"}
            className="figma-input min-h-11 w-full rounded-full px-3.5 text-xs font-semibold text-white outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            {[...new Set([...EXPENSE_CATEGORIES, category])].map(option => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>

        <label className="space-y-1">
          <span className="pl-3 text-[9px] font-bold uppercase tracking-widest text-white/35">Amount ($)</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            inputMode="decimal"
            value={amount}
            onChange={event => setAmount(event.target.value)}
            placeholder="Optional"
            className="figma-input min-h-11 w-full rounded-full px-3.5 text-xs font-semibold text-white outline-none"
          />
        </label>
      </div>

      <div className="mt-3 flex items-center justify-end gap-2">
        {hasOverride && (
          <button type="button" onClick={() => onReset(template.id)} className="figma-soft-button flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-[10px] font-bold text-white/55 transition hover:text-white">
            <RotateCcw size={13} /> Reset
          </button>
        )}
        <button type="submit" className="figma-soft-button flex min-h-10 min-w-20 items-center justify-center gap-2 rounded-full px-4 text-[11px] font-semibold text-white transition">
          {saved && <Check size={14} />} {saved ? "Saved" : "Save"}
        </button>
      </div>
    </form>
  );
};

export const TemplateSettingsView: React.FC<TemplateSettingsViewProps> = ({ templates, overrides, onBack, onSave, onReset, onDelete, triggerConfirm, triggerAlert }) => {
  const overridesById = new Map<string, ExpenseTemplateOverride>(
    overrides.map(override => [override.templateId, override] as [string, ExpenseTemplateOverride])
  );

  return (
    <div className="figma-template-settings mx-auto max-w-3xl space-y-5 md:space-y-6">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onBack} aria-label="Back to settings" className="figma-icon-button shrink-0 text-white/70 transition hover:text-white">
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold text-white">Templates</h2>
          <p className="text-[11px] text-white/40">{templates.length} active</p>
        </div>
      </div>

      {templates.length > 0 ? (
        <div className="space-y-3">
          {templates.map(template => (
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
        <div className="figma-surface rounded-[30px] px-5 py-10 text-center text-xs font-semibold text-white/40">No active templates</div>
      )}

    </div>
  );
};
