import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { dbGet, dbSet } from "../lib/db";
import { STORAGE_KEYS } from "../lib/constants";

function Diagnostics() {
  const navigate = useNavigate();
  const [connected, setConnected] = useState(false);
  const [batteryVoltage, setBatteryVoltage] = useState(null);
  const [rpm, setRpm] = useState(null);

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

  useEffect(() => {
    if (!connected) {
      return undefined;
    }

    const updateLiveValues = () => {
      const nextBattery = (12.1 + Math.random() * 1.5).toFixed(2);
      const nextRpm = Math.floor(720 + Math.random() * 1500);
      setBatteryVoltage(nextBattery);
      setRpm(nextRpm);
    };

    updateLiveValues();
    const intervalId = setInterval(updateLiveValues, 1200);
    return () => clearInterval(intervalId);
  }, [connected]);

  const toggleConnection = async () => {
    const next = !connected;
    setConnected(next);
    await dbSet(STORAGE_KEYS.diagnosticsConnected, next);
  };

  return (
    <main className="page">
      <h2 className="page-title">Diagnostics</h2>

      <section className="card stack">
        <h3 style={{ margin: 0 }}>Connection State</h3>
        <p className={connected ? "" : "warning"} style={{ margin: 0 }}>
          {connected ? "Device connected" : "Device not connected"}
        </p>
        <button type="button" onClick={toggleConnection}>
          {connected ? "Disconnect Device" : "Simulate Connect"}
        </button>
      </section>

      <section className="card stack" style={{ marginTop: 12 }}>
        <h3 style={{ margin: 0 }}>Live Overview</h3>
        <p className="item-row">
          Battery voltage: {connected ? `${batteryVoltage ?? "--"} V` : "--"}
        </p>
        <p className="item-row">RPM: {connected ? rpm ?? "--" : "--"}</p>
      </section>

      <section className="btn-row" style={{ marginTop: 12 }}>
        <button
          type="button"
          onClick={() => navigate("/diagnostics/fault-codes")}
        >
          Fault Codes
        </button>
        <button
          type="button"
          onClick={() => navigate("/diagnostics/relay-tester")}
        >
          Relay Tester
        </button>
      </section>
    </main>
  );
}

export default Diagnostics;
