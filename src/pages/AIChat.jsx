import { useEffect, useMemo, useRef, useState } from "react";
import { dbSet } from "../lib/db";
import { DEFAULT_VEHICLE_INFO, STORAGE_KEYS } from "../lib/constants";
import { createId } from "../lib/helpers";
import SaveCancelModal from "../components/SaveCancelModal";
import EditToggleButton from "../components/EditToggleButton";
import AISettingsFields from "../components/ai/AISettingsFields";
import VehicleProfileUpdateFields from "../components/ai/VehicleProfileUpdateFields";
import ChatMessageList from "../components/ai/ChatMessageList";
import {
  AI_MODELS,
  buildSystemPrompt,
  DEFAULT_AI_MODEL,
  DEFAULT_MAX_OUTPUT_TOKENS,
  DEFAULT_TEMPERATURE,
  GEMINI_ENDPOINT_BASE,
} from "../lib/ai/constants";
import { buildVehicleContext, shouldUseSearchGrounding } from "../lib/ai/context";
import {
  buildUpdateRows,
  createGreetingMessage,
  extractAssistantResponse,
  extractGeminiText,
  extractGroundedSources,
  formatFieldLabel,
  removeInlineUrls,
  sanitizeChatLog,
  toPlainTextWithoutLinkWords,
} from "../lib/ai/responseProcessing";
import {
  loadValueWithFallback,
  normalizeMaxOutputTokens,
  normalizeModel,
  normalizeTemperature,
  saveValueWithFallback,
} from "../lib/ai/settings";

function AIChat() {
  const [vehicleInfo, setVehicleInfo] = useState(DEFAULT_VEHICLE_INFO);
  const [chatLog, setChatLog] = useState([createGreetingMessage("Vehicle")]);
  const [input, setInput] = useState("");

  const [apiKeyInput, setApiKeyInput] = useState("");
  const [savedApiKey, setSavedApiKey] = useState("");
  const [modelInput, setModelInput] = useState(DEFAULT_AI_MODEL);
  const [savedModel, setSavedModel] = useState(DEFAULT_AI_MODEL);
  const [temperatureInput, setTemperatureInput] = useState(String(DEFAULT_TEMPERATURE));
  const [savedTemperature, setSavedTemperature] = useState(DEFAULT_TEMPERATURE);
  const [maxOutputTokensInput, setMaxOutputTokensInput] = useState(
    String(DEFAULT_MAX_OUTPUT_TOKENS)
  );
  const [savedMaxOutputTokens, setSavedMaxOutputTokens] = useState(
    DEFAULT_MAX_OUTPUT_TOKENS
  );

  const [status, setStatus] = useState("");
  const [settingsStatus, setSettingsStatus] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [pendingVehicleUpdate, setPendingVehicleUpdate] = useState(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  const threadEndRef = useRef(null);

  const appendChatMessages = (...messages) => {
    setChatLog((current) => {
      const next = [...current, ...messages];
      dbSet(STORAGE_KEYS.aiChatLog, next);
      return next;
    });
  };

  useEffect(() => {
    let mounted = true;

    Promise.all([
      loadValueWithFallback(STORAGE_KEYS.vehicleInfo, DEFAULT_VEHICLE_INFO),
      loadValueWithFallback(STORAGE_KEYS.aiApiKey, ""),
      loadValueWithFallback(STORAGE_KEYS.aiChatLog, []),
      loadValueWithFallback(STORAGE_KEYS.aiModel, DEFAULT_AI_MODEL),
      loadValueWithFallback(STORAGE_KEYS.aiTemperature, DEFAULT_TEMPERATURE),
      loadValueWithFallback(STORAGE_KEYS.aiMaxOutputTokens, DEFAULT_MAX_OUTPUT_TOKENS),
    ])
      .then(
        ([
          info,
          apiKey,
          storedChatLog,
          storedModel,
          storedTemperature,
          storedMaxOutputTokens,
        ]) => {
          if (!mounted) {
            return;
          }

          const normalizedModel = normalizeModel(storedModel);
          const normalizedTemperature = normalizeTemperature(storedTemperature);
          const normalizedMaxOutputTokens = normalizeMaxOutputTokens(storedMaxOutputTokens);
          const normalizedChat = sanitizeChatLog(storedChatLog);
          const vehicleLabel = info?.model?.trim() || "Vehicle";
          const nextChat =
            normalizedChat.length > 0
              ? normalizedChat
              : [createGreetingMessage(vehicleLabel)];

          setVehicleInfo(info);
          setSavedApiKey(apiKey || "");
          setApiKeyInput(apiKey || "");
          setSavedModel(normalizedModel);
          setModelInput(normalizedModel);
          setSavedTemperature(normalizedTemperature);
          setTemperatureInput(String(normalizedTemperature));
          setSavedMaxOutputTokens(normalizedMaxOutputTokens);
          setMaxOutputTokensInput(String(normalizedMaxOutputTokens));
          setChatLog(nextChat);

          if (normalizedChat.length === 0) {
            dbSet(STORAGE_KEYS.aiChatLog, nextChat);
          }
          if (normalizedModel !== storedModel) {
            saveValueWithFallback(STORAGE_KEYS.aiModel, normalizedModel);
          }
          if (normalizedTemperature !== storedTemperature) {
            saveValueWithFallback(STORAGE_KEYS.aiTemperature, normalizedTemperature);
          }
          if (normalizedMaxOutputTokens !== storedMaxOutputTokens) {
            saveValueWithFallback(
              STORAGE_KEYS.aiMaxOutputTokens,
              normalizedMaxOutputTokens
            );
          }
        }
      )
      .catch(() => {
        if (!mounted) {
          return;
        }
        setChatLog([createGreetingMessage("Vehicle")]);
        setStatus("Could not load saved AI settings. Using defaults.");
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chatLog, isSending]);

  const vehicleContext = useMemo(() => buildVehicleContext(vehicleInfo), [vehicleInfo]);

  const saveSettings = async () => {
    const nextApiKey = apiKeyInput.trim();
    const nextModel = normalizeModel(modelInput);
    const nextTemperature = normalizeTemperature(temperatureInput);
    const nextMaxOutputTokens = normalizeMaxOutputTokens(maxOutputTokensInput);

    try {
      const results = await Promise.all([
        saveValueWithFallback(STORAGE_KEYS.aiApiKey, nextApiKey),
        saveValueWithFallback(STORAGE_KEYS.aiModel, nextModel),
        saveValueWithFallback(STORAGE_KEYS.aiTemperature, nextTemperature),
        saveValueWithFallback(STORAGE_KEYS.aiMaxOutputTokens, nextMaxOutputTokens),
      ]);

      if (results.some((result) => !result)) {
        throw new Error("save-failed");
      }

      setSavedApiKey(nextApiKey);
      setSavedModel(nextModel);
      setModelInput(nextModel);
      setSavedTemperature(nextTemperature);
      setTemperatureInput(String(nextTemperature));
      setSavedMaxOutputTokens(nextMaxOutputTokens);
      setMaxOutputTokensInput(String(nextMaxOutputTokens));
      setStatus("Settings saved.");
      setSettingsStatus("");
      setShowSettingsModal(false);
    } catch {
      setSettingsStatus(
        "Could not save settings on this device. Check browser storage permissions."
      );
    }
  };

  const closeSettingsModal = () => {
    setApiKeyInput(savedApiKey);
    setModelInput(savedModel);
    setTemperatureInput(String(savedTemperature));
    setMaxOutputTokensInput(String(savedMaxOutputTokens));
    setSettingsStatus("");
    setShowSettingsModal(false);
  };

  const toggleSettingsModal = () => {
    setShowSettingsModal((current) => {
      if (current) {
        return false;
      }
      setApiKeyInput(savedApiKey);
      setModelInput(savedModel);
      setTemperatureInput(String(savedTemperature));
      setMaxOutputTokensInput(String(savedMaxOutputTokens));
      setSettingsStatus("");
      return true;
    });
  };

  const applyPendingVehicleUpdate = async () => {
    if (!pendingVehicleUpdate) {
      return;
    }

    const nextUpdates = (pendingVehicleUpdate.rows || []).reduce((acc, row) => {
      const normalized = String(row.newValue ?? "").trim();
      if (!normalized) {
        return acc;
      }
      if (normalized === String(row.previousValue ?? "").trim()) {
        return acc;
      }
      acc[row.field] = normalized;
      return acc;
    }, {});

    if (Object.keys(nextUpdates).length === 0) {
      setPendingVehicleUpdate(null);
      setShowUpdateModal(false);
      appendChatMessages({
        id: createId("ai"),
        role: "ai",
        text: "No profile changes were applied.",
      });
      return;
    }

    const nextVehicleInfo = {
      ...vehicleInfo,
      ...nextUpdates,
    };
    await dbSet(STORAGE_KEYS.vehicleInfo, nextVehicleInfo);
    setVehicleInfo(nextVehicleInfo);
    setPendingVehicleUpdate(null);
    setShowUpdateModal(false);
    appendChatMessages({
      id: createId("ai"),
      role: "ai",
      text: "Vehicle info updated successfully.",
    });
  };

  const cancelPendingVehicleUpdate = () => {
    if (!pendingVehicleUpdate) {
      return;
    }
    setPendingVehicleUpdate(null);
    setShowUpdateModal(false);
    appendChatMessages({
      id: createId("ai"),
      role: "ai",
      text: "Update canceled. Vehicle info was not changed.",
    });
  };

  const editPendingVehicleUpdateField = (field, value) => {
    setPendingVehicleUpdate((current) => {
      if (!current) {
        return current;
      }
      const nextRows = (current.rows || []).map((row) =>
        row.field === field
          ? {
              ...row,
              newValue: value,
            }
          : row
      );
      return {
        ...current,
        rows: nextRows,
      };
    });
  };

  const sendMessage = async () => {
    const key = savedApiKey.trim();
    const userText = input.trim();
    if (!userText || isSending) {
      return;
    }

    if (pendingVehicleUpdate) {
      setStatus("Please confirm or cancel the pending profile update first.");
      return;
    }

    if (!key) {
      setStatus("Please save your Gemini API key first.");
      return;
    }

    const userMessage = { id: createId("user"), role: "user", text: userText };
    const conversation = [...chatLog, userMessage];
    setChatLog(conversation);
    dbSet(STORAGE_KEYS.aiChatLog, conversation);

    setInput("");
    setIsSending(true);
    setStatus("");

    const shouldGroundWithSearch =
      savedModel === "gemini-2.5-flash" && shouldUseSearchGrounding(userText);
    const vehicleContextPayload = {
      vehicle: vehicleContext,
      hasVehicleProfile: Object.values(vehicleContext).some(Boolean),
    };
    const contents = [
      {
        role: "user",
        parts: [{ text: `Vehicle context JSON: ${JSON.stringify(vehicleContextPayload)}` }],
      },
      ...conversation.map((message) => ({
        role: message.role === "ai" ? "model" : "user",
        parts: [{ text: message.text }],
      })),
    ];

    try {
      const endpoint = `${GEMINI_ENDPOINT_BASE}/${savedModel}:generateContent`;
      const requestBody = {
        systemInstruction: {
          parts: [{ text: buildSystemPrompt() }],
        },
        contents,
        generationConfig: {
          temperature: savedTemperature,
          maxOutputTokens: Math.max(savedMaxOutputTokens, DEFAULT_MAX_OUTPUT_TOKENS),
          stopSequences: ["```"],
        },
      };
      if (shouldGroundWithSearch) {
        requestBody.tools = [{ google_search: {} }];
      }

      const response = await fetch(`${endpoint}?key=${encodeURIComponent(key)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const payload = await response.json();
      if (!response.ok) {
        const apiError = payload?.error?.message || "Failed to call Gemini API.";
        throw new Error(apiError);
      }

      const rawText = extractGeminiText(payload);
      if (!rawText) {
        throw new Error("Gemini returned an empty response.");
      }

      const groundedSources = extractGroundedSources(payload);
      const { assistantMessage, proposedUpdates } = extractAssistantResponse(rawText);
      const sourcesForMessage = shouldGroundWithSearch ? groundedSources : [];
      const messageWithoutUrls = shouldGroundWithSearch
        ? removeInlineUrls(assistantMessage)
        : assistantMessage;
      const messageForDisplay = toPlainTextWithoutLinkWords(messageWithoutUrls);
      const safeAssistantMessage =
        messageForDisplay || "I found relevant results in the sources below.";

      const updateRows = buildUpdateRows(vehicleInfo, proposedUpdates).filter(
        (row) => row.previousValue !== row.newValue
      );

      if (updateRows.length > 0) {
        setPendingVehicleUpdate({ rows: updateRows });
        setShowUpdateModal(true);
        appendChatMessages({
          id: createId("ai"),
          role: "ai",
          text: "I found profile updates. Please review the popup to confirm or cancel.",
          sources: sourcesForMessage,
        });
      } else {
        appendChatMessages({
          id: createId("ai"),
          role: "ai",
          text: safeAssistantMessage,
          sources: sourcesForMessage,
        });
      }
    } catch (error) {
      setStatus(error.message || "Failed to call Gemini API.");
      appendChatMessages({
        id: createId("ai"),
        role: "ai",
        text: "I couldn't complete the request. Check your API key, model, or connection and try again.",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <main className="page page-ai-chat">
      <h2 className="page-title">AI Chat</h2>

      <ChatMessageList chatLog={chatLog} isSending={isSending} threadEndRef={threadEndRef} />

      <section className="chat-composer">
        <div className="chat-composer-inner">
          {status && (
            <p className={status.toLowerCase().includes("saved") ? "muted" : "warning"}>
              {status}
            </p>
          )}
          <div className="chat-input-row">
            <input
              className="input"
              placeholder="What oil can I use?"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  sendMessage();
                }
              }}
            />
            <button
              type="button"
              className="btn-primary chat-send-button"
              onClick={sendMessage}
              disabled={!savedApiKey.trim() || isSending || !input.trim() || showUpdateModal}
            >
              Send
            </button>
          </div>
        </div>
      </section>

      <EditToggleButton
        active={showSettingsModal}
        onClick={toggleSettingsModal}
        label="Settings"
        className="fab fab-left ai-settings-fab"
      />

      <SaveCancelModal
        open={showSettingsModal}
        title="AI Settings"
        saveLabel="Save"
        cancelLabel="Close"
        onSave={saveSettings}
        onCancel={closeSettingsModal}
      >
        <AISettingsFields
          apiKeyInput={apiKeyInput}
          onApiKeyChange={(value) => {
            setApiKeyInput(value);
            setStatus("");
          }}
          modelInput={modelInput}
          onModelChange={setModelInput}
          models={AI_MODELS}
          temperatureInput={temperatureInput}
          onTemperatureChange={setTemperatureInput}
          maxOutputTokensInput={maxOutputTokensInput}
          onMaxOutputTokensChange={setMaxOutputTokensInput}
          settingsStatus={settingsStatus}
        />
      </SaveCancelModal>

      <SaveCancelModal
        open={showUpdateModal}
        title="Vehicle Profile Updates"
        saveLabel="Apply"
        cancelLabel="Cancel"
        onSave={applyPendingVehicleUpdate}
        onCancel={cancelPendingVehicleUpdate}
      >
        <VehicleProfileUpdateFields
          rows={pendingVehicleUpdate?.rows}
          formatFieldLabel={formatFieldLabel}
          onChange={editPendingVehicleUpdateField}
        />
      </SaveCancelModal>
    </main>
  );
}

export default AIChat;
