import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { dbGet, dbSet } from "../lib/db";
import { FAULT_CODE_CATALOG, STORAGE_KEYS } from "../lib/constants";
import { createId } from "../lib/helpers";

function FaultCodes() {
  const navigate = useNavigate();
  const [connected, setConnected] = useState(false);
  const [codes, setCodes] = useState([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    let mounted = true;
    Promise.all([
      dbGet(STORAGE_KEYS.diagnosticsConnected, false),
      dbGet(STORAGE_KEYS.currentFaultCodes, []),
    ]).then(([isConnected, storedCodes]) => {
      if (!mounted) {
        return;
      }
      setConnected(Boolean(isConnected));
      setCodes(storedCodes);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const scanFaultCodes = async () => {
    if (!connected) {
      setStatus("Cannot scan while device is disconnected.");
      return;
    }

    const count = Math.floor(Math.random() * 4);
    const shuffled = [...FAULT_CODE_CATALOG].sort(() => 0.5 - Math.random());
    const nextCodes = shuffled.slice(0, count);
    await dbSet(STORAGE_KEYS.currentFaultCodes, nextCodes);
    setCodes(nextCodes);

    if (nextCodes.length > 0) {
      const history = await dbGet(STORAGE_KEYS.faultHistory, []);
      const entries = nextCodes.map((code) => ({
        id: createId("fault"),
        code: code.code,
        name: code.name,
        detectedAt: new Date().toISOString(),
        mileage: "",
      }));
      await dbSet(STORAGE_KEYS.faultHistory, [...entries, ...history]);
      setStatus(`${nextCodes.length} fault code(s) found and saved to history.`);
      return;
    }

    setStatus("Scan completed. No fault codes detected.");
  };

  const renderedCodes = useMemo(() => {
    if (!codes.length) {
      return <p className="muted">No current fault codes.</p>;
    }
    return (
      <div className="list">
        {codes.map((entry) => (
          <article className="card" key={entry.code}>
            <h3 className="item-title">{entry.code}</h3>
            <p className="item-row">{entry.name}</p>
          </article>
        ))}
      </div>
    );
  }, [codes]);

  return (
    <main className="page">
      <h2 className="page-title">Current Fault Codes</h2>

      {renderedCodes}

      {status && <p className="muted">{status}</p>}

      <section className="stack" style={{ marginTop: 12 }}>
        <button
          type="button"
          className="btn-primary"
          disabled={!connected}
          onClick={scanFaultCodes}
        >
          Scan for Fault Codes
        </button>
        <button
          type="button"
          onClick={() => navigate("/diagnostics/fault-history")}
        >
          View History
        </button>
        <button type="button" onClick={() => navigate("/diagnostics")}>
          Back
        </button>
      </section>
    </main>
  );
}

export default FaultCodes;
