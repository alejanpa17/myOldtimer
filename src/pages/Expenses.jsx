import { useEffect, useMemo, useState } from "react";
import { dbGet, dbSet } from "../lib/db";
import { DEFAULT_CHECKLIST, normalizeChecklistData } from "../lib/checklist";
import { STORAGE_KEYS } from "../lib/constants";
import {
  EXPENSE_CATEGORIES,
  SUPPORTED_CURRENCIES,
  collectExpenseItems,
  formatExpense,
  getCategoryTotals,
  getMonthlyTotals,
  normalizeCurrency,
} from "../lib/expenses";

function Expenses() {
  const [records, setRecords] = useState({
    fuelEntries: [],
    maintenanceEntries: [],
    replacementEntries: [],
    checklist: DEFAULT_CHECKLIST,
  });
  const [currency, setCurrency] = useState("EUR");

  useEffect(() => {
    let mounted = true;
    Promise.all([
      dbGet(STORAGE_KEYS.fuelEfficiencyEntries, []),
      dbGet(STORAGE_KEYS.maintenanceHistory, []),
      dbGet(STORAGE_KEYS.replaceHistory, []),
      dbGet(STORAGE_KEYS.checklistData, DEFAULT_CHECKLIST),
      dbGet(STORAGE_KEYS.expenseCurrency, "EUR"),
    ]).then(([fuelEntries, maintenanceEntries, replacementEntries, checklist, savedCurrency]) => {
      if (!mounted) return;
      setRecords({
        fuelEntries,
        maintenanceEntries,
        replacementEntries,
        checklist: normalizeChecklistData(checklist),
      });
      setCurrency(normalizeCurrency(savedCurrency));
    });
    return () => {
      mounted = false;
    };
  }, []);

  const items = useMemo(() => collectExpenseItems(records), [records]);
  const categories = useMemo(() => getCategoryTotals(items), [items]);
  const months = useMemo(() => getMonthlyTotals(items), [items]);
  const total = useMemo(
    () => items.reduce((sum, item) => sum + item.amount, 0),
    [items]
  );
  const currentYear = new Date().getFullYear();
  const yearTotal = useMemo(
    () => items
      .filter((item) => item.date?.startsWith(String(currentYear)))
      .reduce((sum, item) => sum + item.amount, 0),
    [currentYear, items]
  );
  const maxCategory = Math.max(...categories.map((item) => item.total), 1);
  const maxMonth = Math.max(...months.map((month) => month.total), 1);

  const changeCurrency = async (value) => {
    const nextCurrency = normalizeCurrency(value);
    setCurrency(nextCurrency);
    await dbSet(STORAGE_KEYS.expenseCurrency, nextCurrency);
  };

  return (
    <main className="page expenses-page">
      <header className="expenses-header">
        <div>
          <p className="eyebrow">Ownership costs</p>
          <h2 className="page-title">Expenses</h2>
        </div>
        <label className="currency-picker">
          <span>Currency</span>
          <select
            className="select"
            value={currency}
            onChange={(event) => changeCurrency(event.target.value)}
          >
            {SUPPORTED_CURRENCIES.map((code) => (
              <option key={code} value={code}>{code}</option>
            ))}
          </select>
        </label>
      </header>

      <section className="expense-summary-grid" aria-label="Expense summary">
        <article className="expense-total-card">
          <span className="status-kicker">All-time spend</span>
          <strong>{formatExpense(total, currency)}</strong>
          <span className="status-note">Across {items.length} priced records</span>
        </article>
        <article className="expense-total-card expense-total-card-secondary">
          <span className="status-kicker">{currentYear}</span>
          <strong>{formatExpense(yearTotal, currency)}</strong>
          <span className="status-note">Current calendar year</span>
        </article>
      </section>

      <section className="card expense-section" aria-labelledby="category-cost-title">
        <div className="expense-section-heading">
          <div>
            <p className="eyebrow">Breakdown</p>
            <h3 id="category-cost-title">Spend by category</h3>
          </div>
        </div>
        <div className="expense-category-list">
          {categories.map((category) => (
            <div className="expense-category-row" key={category.id}>
              <div className="expense-category-meta">
                <span className="expense-legend-dot" style={{ background: category.color }} />
                <strong>{category.label}</strong>
                <span>{formatExpense(category.total, currency)}</span>
              </div>
              <div className="expense-track" aria-hidden="true">
                <span
                  style={{
                    width: `${(category.total / maxCategory) * 100}%`,
                    background: category.color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card expense-section" aria-labelledby="monthly-cost-title">
        <div className="expense-section-heading">
          <div>
            <p className="eyebrow">Last 12 months</p>
            <h3 id="monthly-cost-title">Monthly spend</h3>
          </div>
        </div>
        <div className="expense-month-chart" role="img" aria-label="Expense totals for the last twelve months">
          {months.map((month) => (
            <div className="expense-month" key={month.key} title={`${month.fullLabel}: ${formatExpense(month.total, currency)}`}>
              <span className="expense-month-value">
                {month.total > 0 ? formatExpense(month.total, currency) : ""}
              </span>
              <span className="expense-month-bar-wrap" aria-hidden="true">
                <span style={{ height: `${(month.total / maxMonth) * 100}%` }} />
              </span>
              <span className="expense-month-label">{month.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="expense-section" aria-labelledby="recent-cost-title">
        <div className="expense-section-heading">
          <div>
            <p className="eyebrow">Ledger</p>
            <h3 id="recent-cost-title">Recent expenses</h3>
          </div>
        </div>
        <div className="list">
          {items.length === 0 && (
            <article className="card expense-empty-state">
              <strong>No expenses yet</strong>
              <p className="muted">Add prices to fuel, maintenance, replacement parts, or completed checklist subtasks.</p>
            </article>
          )}
          {items.slice(0, 12).map((item) => {
            const category = EXPENSE_CATEGORIES.find((entry) => entry.id === item.category);
            return (
              <article className="card expense-ledger-row" key={item.id}>
                <span className="expense-ledger-icon" style={{ color: category?.color }} aria-hidden="true">&#9679;</span>
                <span>
                  <strong>{item.label}</strong>
                  <small>{category?.label} / {item.date || "No date"}</small>
                </span>
                <strong>{formatExpense(item.amount, currency)}</strong>
              </article>
            );
          })}
        </div>
      </section>

      <p className="expense-currency-note">Changing currency changes the display unit only; stored amounts are not converted.</p>
    </main>
  );
}

export default Expenses;
