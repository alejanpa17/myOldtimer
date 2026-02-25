import { useEffect, useState } from "react";
import { dbGet } from "../lib/db";
import { STORAGE_KEYS } from "../lib/constants";

function RelayTester() {
  const [connected, setConnected] = useState(false);
  const [pendingCommand, setPendingCommand] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    let mounted = true;
    dbGet(STORAGE_KEYS.diagnosticsConnected, false).then((value) => {
      if (mounted) {
        setConnected(Boolean(value));
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const askToSend = (command) => {
    if (!connected) {
      setStatus("Connect the device before sending relay commands.");
      return;
    }
    setPendingCommand(command);
  };

  const confirmSend = () => {
    const message = `${pendingCommand} command sent successfully.`;
    setStatus(message);
    setPendingCommand("");
  };

  return (
    <main className="page">
      <h2 className="page-title">Relay Tester</h2>

      <section className="stack">
        <button type="button" onClick={() => askToSend("Fuel Pump")}>
          Fuel Pump
        </button>
        <button type="button" onClick={() => askToSend("Cooling Fan")}>
          Cooling Fan
        </button>
      </section>

      {status && <p className="muted">{status}</p>}

      {pendingCommand && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal stack">
            <h3 style={{ margin: 0 }}>Are you sure?</h3>
            <p className="muted" style={{ margin: 0 }}>
              This will activate: {pendingCommand}
            </p>
            <div className="btn-row">
              <button type="button" className="btn-primary" onClick={confirmSend}>
                Yes
              </button>
              <button type="button" onClick={() => setPendingCommand("")}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default RelayTester;
