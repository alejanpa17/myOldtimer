export const EXPENSE_CATEGORIES = [
  { id: "fuel", label: "Fuel", color: "#77cad1" },
  { id: "maintenance", label: "Maintenance", color: "#d7a84d" },
  { id: "parts", label: "Parts", color: "#ed7468" },
  { id: "checklist", label: "Checklist", color: "#69c48d" },
];

export const SUPPORTED_CURRENCIES = ["EUR", "USD", "GBP", "CHF"];

export function parseExpenseAmount(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(String(value).trim().replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function normalizeCurrency(value) {
  return SUPPORTED_CURRENCIES.includes(value) ? value : "EUR";
}

export function formatExpense(value, currency = "EUR") {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: normalizeCurrency(currency),
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function expenseItem(category, amount, date, label, id) {
  const parsedAmount = parseExpenseAmount(amount);
  if (parsedAmount === null || parsedAmount <= 0) {
    return null;
  }
  return {
    id,
    category,
    amount: parsedAmount,
    date: date || "",
    label,
  };
}

export function collectExpenseItems({
  fuelEntries = [],
  maintenanceEntries = [],
  replacementEntries = [],
  checklist = { todo: [], done: [] },
} = {}) {
  const items = [];

  fuelEntries.forEach((entry, index) => {
    const item = expenseItem(
      "fuel",
      entry?.totalPrice,
      entry?.date,
      entry?.liters ? `${entry.liters} L refuel` : "Refuel",
      entry?.id || `fuel-expense-${index}`
    );
    if (item) items.push(item);
  });

  maintenanceEntries.forEach((entry, index) => {
    const item = expenseItem(
      "maintenance",
      entry?.cost,
      entry?.date,
      (entry?.categories || []).join(", ") || "Maintenance",
      entry?.id || `maintenance-expense-${index}`
    );
    if (item) items.push(item);
  });

  replacementEntries.forEach((entry, entryIndex) => {
    const partItems = Array.isArray(entry?.partItems)
      ? entry.partItems
      : (entry?.parts || []).map((name, partIndex) => ({
          id: `legacy-part-${partIndex}`,
          name,
          price: null,
        }));
    partItems.forEach((part, partIndex) => {
      const item = expenseItem(
        "parts",
        part?.price,
        entry?.date,
        part?.name || "Replacement part",
        `${entry?.id || `replacement-${entryIndex}`}-${part?.id || partIndex}`
      );
      if (item) items.push(item);
    });
  });

  [...(checklist?.todo || []), ...(checklist?.done || [])].forEach(
    (task, taskIndex) => {
      (task?.subtasks || []).forEach((subtask, subtaskIndex) => {
        const item = expenseItem(
          "checklist",
          subtask?.cost,
          subtask?.completedDate,
          subtask?.name || task?.taskName || "Checklist item",
          `${task?.id || `task-${taskIndex}`}-${subtask?.id || subtaskIndex}`
        );
        if (item) items.push(item);
      });
    }
  );

  return items.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

export function getCategoryTotals(items) {
  return EXPENSE_CATEGORIES.map((category) => ({
    ...category,
    total: items
      .filter((item) => item.category === category.id)
      .reduce((sum, item) => sum + item.amount, 0),
  }));
}

export function getMonthlyTotals(items, monthCount = 12, now = new Date()) {
  const totalsByMonth = new Map();
  items.forEach((item) => {
    if (!/^\d{4}-\d{2}/.test(item.date || "")) {
      return;
    }
    const key = item.date.slice(0, 7);
    totalsByMonth.set(key, (totalsByMonth.get(key) || 0) + item.amount);
  });

  return Array.from({ length: monthCount }, (_, offset) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (monthCount - 1 - offset), 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    return {
      key,
      label: date.toLocaleDateString(undefined, { month: "short" }),
      fullLabel: date.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
      total: totalsByMonth.get(key) || 0,
    };
  });
}
