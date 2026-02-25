import { useEffect, useState } from "react";
import { dbGet } from "../lib/db";
import { STORAGE_KEYS } from "../lib/constants";
import { formatDateTime } from "../lib/helpers";

function FaultHistory() {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    let mounted = true;
    dbGet(STORAGE_KEYS.faultHistory, []).then((entries) => {
      if (mounted) {
        setHistory(entries);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <main className="page">
      <h2 className="page-title">Fault Code History</h2>

      <section className="list">
        {history.length === 0 && (
          <article className="card">
            <p className="muted">No fault history yet.</p>
          </article>
        )}
        {history.map((entry) => (
          <article className="card" key={entry.id}>
            <h3 className="item-title">{entry.code}</h3>
            <p className="item-row">{entry.name}</p>
            <p className="item-row">Date detected: {formatDateTime(entry.detectedAt)}</p>
            {entry.mileage && <p className="item-row">Mileage: {entry.mileage}</p>}
          </article>
        ))}
      </section>
    </main>
  );
}

export default FaultHistory;
