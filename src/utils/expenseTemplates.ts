import { ExpenseItem, ExpenseTemplate, FinanceData } from "../types";

const normalizeTitle = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase();

const monthIndex = (monthStr: string) => {
  const [year, month] = monthStr.split("-").map(Number);
  return year * 12 + month - 1;
};

type ExpenseOccurrence = {
  monthStr: string;
  item: ExpenseItem;
};

export const buildExpenseTemplates = (data: FinanceData, includeHidden = false): ExpenseTemplate[] => {
  const occurrencesByTitle = new Map<string, ExpenseOccurrence[]>();

  for (const budget of data.monthlyBudgets) {
    for (const item of budget.expenses) {
      if (item.type === "income" || !item.description.trim()) continue;
      const key = normalizeTitle(item.description);
      const occurrences = occurrencesByTitle.get(key) ?? [];
      occurrences.push({ monthStr: budget.monthStr, item });
      occurrencesByTitle.set(key, occurrences);
    }
  }

  const templates = new Map<string, ExpenseTemplate>();

  for (const [key, occurrences] of occurrencesByTitle) {
    const latestByMonth = new Map<string, ExpenseOccurrence>();
    for (const occurrence of occurrences) latestByMonth.set(occurrence.monthStr, occurrence);
    const monthlyOccurrences = [...latestByMonth.values()].sort((a, b) => a.monthStr.localeCompare(b.monthStr));

    let streak = 1;
    let qualifies = false;
    for (let index = 1; index < monthlyOccurrences.length; index += 1) {
      streak = monthIndex(monthlyOccurrences[index].monthStr) === monthIndex(monthlyOccurrences[index - 1].monthStr) + 1
        ? streak + 1
        : 1;
      if (streak >= 4) qualifies = true;
    }
    if (!qualifies) continue;

    const latest = monthlyOccurrences[monthlyOccurrences.length - 1].item;
    templates.set(key, {
      id: `recurring:${key}`,
      title: latest.description.trim(),
      category: latest.category,
      amount: latest.amount,
      originalAmount: latest.originalAmount,
      originalCurrency: latest.originalCurrency,
      originalRate: latest.originalRate,
      source: "recurring",
    });
  }

  for (const debt of data.debts ?? []) {
    const paid = debt.payments.reduce((sum, payment) => sum + payment.amount, 0);
    const remaining = Math.max(debt.totalAmount - paid, 0);
    if (remaining <= 0.005) continue;

    const key = normalizeTitle(debt.name);
    const matchingOccurrences = occurrencesByTitle.get(key) ?? [];
    const latest = matchingOccurrences.sort((a, b) => b.monthStr.localeCompare(a.monthStr))[0]?.item;
    const suggestedAmount = latest?.amount ? Math.min(latest.amount, remaining) : undefined;
    const canReuseOriginalCurrency = Boolean(latest && latest.amount <= remaining + 0.005);

    templates.set(key, {
      id: `debt:${debt.id}`,
      title: debt.name.trim(),
      category: "Debt",
      amount: suggestedAmount,
      originalAmount: canReuseOriginalCurrency ? latest?.originalAmount : undefined,
      originalCurrency: canReuseOriginalCurrency ? latest?.originalCurrency : undefined,
      originalRate: canReuseOriginalCurrency ? latest?.originalRate : undefined,
      source: "debt",
    });
  }

  const overrides = new Map((data.expenseTemplateOverrides ?? []).map(override => [override.templateId, override]));
  const resolvedTemplates = [...templates.values()].filter(template => {
    return includeHidden || !overrides.get(template.id)?.hidden;
  }).map(template => {
    const override = overrides.get(template.id);
    if (!override) return template;

    return {
      ...template,
      title: template.source === "debt" ? template.title : override.title ?? template.title,
      category: template.source === "debt" ? "Debt" : override.category ?? template.category,
      amount: override.amount === null ? undefined : override.amount ?? template.amount,
      originalAmount: override.amount !== undefined ? undefined : template.originalAmount,
      originalCurrency: override.amount !== undefined ? undefined : template.originalCurrency,
      originalRate: override.amount !== undefined ? undefined : template.originalRate,
    };
  });

  return resolvedTemplates.sort((a, b) => {
    if (a.source !== b.source) return a.source === "debt" ? -1 : 1;
    return a.title.localeCompare(b.title);
  });
};
