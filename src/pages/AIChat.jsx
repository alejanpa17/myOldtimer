import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { dbGet } from "../lib/db";
import { DEFAULT_VEHICLE_INFO, STORAGE_KEYS } from "../lib/constants";
import { createId } from "../lib/helpers";

function AIChat() {
  const navigate = useNavigate();
  const [vehicleInfo, setVehicleInfo] = useState(DEFAULT_VEHICLE_INFO);
  const [chatLog, setChatLog] = useState([]);
  const [input, setInput] = useState("");

  useEffect(() => {
    let mounted = true;
    dbGet(STORAGE_KEYS.vehicleInfo, DEFAULT_VEHICLE_INFO).then((info) => {
      if (mounted) {
        setVehicleInfo(info);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const modelLabel = useMemo(() => {
    return vehicleInfo.model?.trim() || "Vehicle";
  }, [vehicleInfo.model]);

  const greeting = useMemo(() => {
    return {
      id: `ai-greeting-${modelLabel}`,
      role: "ai",
      text: `Hello! I'm your assistant for your ${modelLabel}. How can I help you today?`,
    };
  }, [modelLabel]);

  const sendMessage = () => {
    if (!input.trim()) {
      return;
    }

    const nextMessages = [
      ...chatLog,
      { id: createId("user"), role: "user", text: input.trim() },
      {
        id: createId("ai"),
        role: "ai",
        text: "This is a UI placeholder. AI backend logic is not connected yet.",
      },
    ];
    setChatLog(nextMessages);
    setInput("");
  };

  return (
    <main className="page">
      <div className="topbar">
        <button type="button" onClick={() => navigate("/")}>
          Back
        </button>
      </div>
      <h2 className="page-title">AI Chat</h2>

      <section className="list" style={{ marginBottom: 12 }}>
        {[greeting, ...chatLog].map((message) => (
          <article className="card" key={message.id}>
            <p className="item-row" style={{ marginTop: 0 }}>
              <strong>{message.role === "ai" ? "AI" : "You"}:</strong> {message.text}
            </p>
          </article>
        ))}
      </section>

      <section className="card field-grid">
        <input
          className="input"
          placeholder="What oil can I use?"
          value={input}
          onChange={(event) => setInput(event.target.value)}
        />
        <button type="button" onClick={sendMessage}>
          Send
        </button>
      </section>
    </main>
  );
}

export default AIChat;
