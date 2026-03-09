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
import { buildVehicleContext } from "../lib/ai/context";
import {
  buildUpdateRows,
  createGreetingMessage,
  extractAssistantResponse,
  extractGeminiText,
  extractGroundedVideos,
  extractGroundedSources,
  formatFieldLabel,
  sanitizeChatLog,
} from "../lib/ai/responseProcessing";
import {
  loadValueWithFallback,
  normalizeDebugFlag,
  normalizeMaxOutputTokens,
  normalizeModel,
  normalizeTemperature,
  saveValueWithFallback,
} from "../lib/ai/settings";
import {
  prepareGroundedVideosForDisplay,
  resolveGroundedVideosInBackground,
  normalizeThumbnailCache,
  normalizeVideoRedirectCache,
} from "../lib/ai/videos";
import { aiDebugError, aiDebugLog, setAiDebugEnabled } from "../lib/ai/debug";

function normalizeOptionalBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value === 1;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "1" || normalized === "true" || normalized === "yes") {
      return true;
    }
    if (normalized === "0" || normalized === "false" || normalized === "no") {
      return false;
    }
  }
  return null;
}

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
  const [debugEnabledInput, setDebugEnabledInput] = useState(false);
  const [savedDebugEnabled, setSavedDebugEnabled] = useState(false);
  const [popupThumbnailsEnabledInput, setPopupThumbnailsEnabledInput] = useState(false);
  const [savedPopupThumbnailsEnabled, setSavedPopupThumbnailsEnabled] = useState(false);

  const [status, setStatus] = useState("");
  const [settingsStatus, setSettingsStatus] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [pendingVehicleUpdate, setPendingVehicleUpdate] = useState(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [videoThumbnailCache, setVideoThumbnailCache] = useState({});
  const [videoRedirectCache, setVideoRedirectCache] = useState({});

  const threadEndRef = useRef(null);

  const appendChatMessages = (...messages) => {
    setChatLog((current) => {
      const next = [...current, ...messages];
      dbSet(STORAGE_KEYS.aiChatLog, next);
      aiDebugLog("chat", "appended_messages", {
        appended: messages.length,
        total: next.length,
      });
      return next;
    });
  };

  const updateChatMessageById = (messageId, updater) => {
    setChatLog((current) => {
      let changed = false;
      const next = current.map((message) => {
        if (message.id !== messageId) {
          return message;
        }
        changed = true;
        return updater(message);
      });

      if (changed) {
        dbSet(STORAGE_KEYS.aiChatLog, next);
      }
      return changed ? next : current;
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
      loadValueWithFallback(STORAGE_KEYS.aiVideoThumbnailsEnabled, false),
      loadValueWithFallback(STORAGE_KEYS.aiVideoThumbnailCache, {}),
      loadValueWithFallback(STORAGE_KEYS.aiVideoRedirectCache, {}),
      loadValueWithFallback(STORAGE_KEYS.aiDebug, false),
    ])
      .then(
        ([
          info,
          apiKey,
          storedChatLog,
          storedModel,
          storedTemperature,
          storedMaxOutputTokens,
          storedVideoThumbnailsEnabled,
          storedVideoThumbnailCache,
          storedVideoRedirectCache,
          storedAiDebug,
        ]) => {
          if (!mounted) {
            return;
          }

          const normalizedModel = normalizeModel(storedModel);
          const normalizedTemperature = normalizeTemperature(storedTemperature);
          const normalizedMaxOutputTokens = normalizeMaxOutputTokens(storedMaxOutputTokens);
          const normalizedDebugEnabled = normalizeDebugFlag(storedAiDebug);
          const normalizedChat = sanitizeChatLog(storedChatLog);
          const normalizedInfo = {
            ...DEFAULT_VEHICLE_INFO,
            ...(info || {}),
          };
          const vehicleLabel = normalizedInfo?.model?.trim() || "Vehicle";
          const nextChat =
            normalizedChat.length > 0
              ? normalizedChat
              : [createGreetingMessage(vehicleLabel)];

          setVehicleInfo(normalizedInfo);
          setSavedApiKey(apiKey || "");
          setApiKeyInput(apiKey || "");
          setSavedModel(normalizedModel);
          setModelInput(normalizedModel);
          setSavedTemperature(normalizedTemperature);
          setTemperatureInput(String(normalizedTemperature));
          setSavedMaxOutputTokens(normalizedMaxOutputTokens);
          setMaxOutputTokensInput(String(normalizedMaxOutputTokens));
          setSavedDebugEnabled(normalizedDebugEnabled);
          setDebugEnabledInput(normalizedDebugEnabled);
          setChatLog(nextChat);
          setVideoThumbnailCache(normalizeThumbnailCache(storedVideoThumbnailCache));
          setVideoRedirectCache(normalizeVideoRedirectCache(storedVideoRedirectCache));
          const enabled = Boolean(normalizeOptionalBoolean(storedVideoThumbnailsEnabled));
          setPopupThumbnailsEnabledInput(enabled);
          setSavedPopupThumbnailsEnabled(enabled);
          setAiDebugEnabled(normalizedDebugEnabled);

          aiDebugLog("init", "loaded_state", {
            chatMessages: nextChat.length,
            model: normalizedModel,
            temperature: normalizedTemperature,
            maxOutputTokens: normalizedMaxOutputTokens,
            debugEnabled: normalizedDebugEnabled,
          });

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
          if (normalizedDebugEnabled !== storedAiDebug) {
            saveValueWithFallback(STORAGE_KEYS.aiDebug, normalizedDebugEnabled);
          }
        }
      )
      .catch(() => {
        if (!mounted) {
          return;
        }
        setChatLog([createGreetingMessage("Vehicle")]);
        setStatus("Could not load saved AI settings. Using defaults.");
        aiDebugError("init", "load_failed", new Error("load_failed"));
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chatLog, isSending]);

  const vehicleContext = useMemo(() => buildVehicleContext(vehicleInfo), [vehicleInfo]);

  const handlePopupThumbnailsEnabledChange = async (checked) => {
    setPopupThumbnailsEnabledInput(Boolean(checked));
    setSettingsStatus("");
  };

  const saveSettings = async () => {
    const nextApiKey = apiKeyInput.trim();
    const nextModel = normalizeModel(modelInput);
    const nextTemperature = normalizeTemperature(temperatureInput);
    const nextMaxOutputTokens = normalizeMaxOutputTokens(maxOutputTokensInput);
    const nextDebugEnabled = normalizeDebugFlag(debugEnabledInput);
    const nextVideoThumbnailsEnabled = Boolean(popupThumbnailsEnabledInput);

    try {
      const results = await Promise.all([
        saveValueWithFallback(STORAGE_KEYS.aiApiKey, nextApiKey),
        saveValueWithFallback(STORAGE_KEYS.aiModel, nextModel),
        saveValueWithFallback(STORAGE_KEYS.aiTemperature, nextTemperature),
        saveValueWithFallback(STORAGE_KEYS.aiMaxOutputTokens, nextMaxOutputTokens),
        saveValueWithFallback(
          STORAGE_KEYS.aiVideoThumbnailsEnabled,
          nextVideoThumbnailsEnabled
        ),
        saveValueWithFallback(STORAGE_KEYS.aiDebug, nextDebugEnabled),
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
      setSavedDebugEnabled(nextDebugEnabled);
      setDebugEnabledInput(nextDebugEnabled);
      setSavedPopupThumbnailsEnabled(nextVideoThumbnailsEnabled);
      setAiDebugEnabled(nextDebugEnabled);
      setStatus("Settings saved.");
      setSettingsStatus("");
      setShowSettingsModal(false);
      aiDebugLog("settings", "saved", {
        model: nextModel,
        temperature: nextTemperature,
        maxOutputTokens: nextMaxOutputTokens,
        debugEnabled: nextDebugEnabled,
        videoThumbnailsEnabled: nextVideoThumbnailsEnabled,
      });
    } catch {
      setSettingsStatus(
        "Could not save settings on this device. Check browser storage permissions."
      );
      aiDebugError("settings", "save_failed", new Error("save_failed"));
    }
  };

  const closeSettingsModal = () => {
    setApiKeyInput(savedApiKey);
    setModelInput(savedModel);
    setTemperatureInput(String(savedTemperature));
    setMaxOutputTokensInput(String(savedMaxOutputTokens));
    setDebugEnabledInput(savedDebugEnabled);
    setPopupThumbnailsEnabledInput(savedPopupThumbnailsEnabled);
    setSettingsStatus("");
    setShowSettingsModal(false);
    aiDebugLog("settings", "closed_without_save");
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
      setDebugEnabledInput(savedDebugEnabled);
      setPopupThumbnailsEnabledInput(savedPopupThumbnailsEnabled);
      setSettingsStatus("");
      aiDebugLog("settings", "opened");
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
      aiDebugLog("vehicle_update", "apply_skipped_no_changes");
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
    aiDebugLog("vehicle_update", "applied", {
      changedFields: Object.keys(nextUpdates),
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
    aiDebugLog("vehicle_update", "canceled");
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
      aiDebugLog("send", "blocked_empty_or_busy", {
        hasText: Boolean(userText),
        isSending,
      });
      return;
    }

    if (pendingVehicleUpdate) {
      setStatus("Please confirm or cancel the pending profile update first.");
      aiDebugLog("send", "blocked_pending_vehicle_update");
      return;
    }

    if (!key) {
      setStatus("Please save your Gemini API key first.");
      aiDebugLog("send", "blocked_missing_api_key");
      return;
    }

    const userMessage = { id: createId("user"), role: "user", text: userText };
    const conversation = [...chatLog, userMessage];
    setChatLog(conversation);
    dbSet(STORAGE_KEYS.aiChatLog, conversation);

    setInput("");
    setIsSending(true);
    setStatus("");

    const shouldGroundWithSearch = savedModel === "gemini-2.5-flash";
    const canLoadThumbnails = shouldGroundWithSearch && savedPopupThumbnailsEnabled;
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
      aiDebugLog("request", "building_payload", {
        model: savedModel,
        withGoogleSearch: shouldGroundWithSearch,
        conversationMessages: conversation.length,
      });
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
      aiDebugLog("request", "api_request_payload", requestBody);

      const response = await fetch(`${endpoint}?key=${encodeURIComponent(key)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const payload = await response.json();
      aiDebugLog("response", "api_raw_payload", {
        status: response.status,
        payload,
      });
      if (!response.ok) {
        const apiError = payload?.error?.message || "Failed to call Gemini API.";
        aiDebugError("response", "api_error", new Error(apiError), {
          status: response.status,
          payload,
        });
        throw new Error(apiError);
      }
      aiDebugLog("response", "api_ok", {
        status: response.status,
      });

      const rawText = extractGeminiText(payload);
      if (!rawText) {
        throw new Error("Gemini returned an empty response.");
      }

      const groundedSources = extractGroundedSources(payload);
      const groundedVideos = extractGroundedVideos(payload, rawText);
      const { assistantMessage, proposedUpdates } = extractAssistantResponse(rawText);
      aiDebugLog("response", "parsed", {
        textLength: rawText.length,
        sources: groundedSources.length,
        groundedVideos: groundedVideos.length,
        proposedUpdateFields: Object.keys(proposedUpdates),
      });
      const aiMessageId = createId("ai");
      const sourcesForMessage = shouldGroundWithSearch ? groundedSources : [];
      let videosForMessage = [];
      let preparedVideoPayload = null;
      if (shouldGroundWithSearch && groundedVideos.length > 0) {
        if (canLoadThumbnails) {
          const prepared = prepareGroundedVideosForDisplay(
            groundedVideos,
            videoThumbnailCache,
            videoRedirectCache
          );
          videosForMessage = prepared.videos;
          preparedVideoPayload = {
            videos: prepared.videos,
            nextThumbnailCache: prepared.nextThumbnailCache,
            nextVideoRedirectCache: prepared.nextVideoRedirectCache,
          };
          aiDebugLog("videos", "prepared_for_display", {
            input: groundedVideos.length,
            initialOutput: prepared.videos.length,
          });
        }
      }
      const safeAssistantMessage = assistantMessage;

      const updateRows = buildUpdateRows(vehicleInfo, proposedUpdates).filter(
        (row) => row.previousValue !== row.newValue
      );

      if (updateRows.length > 0) {
        setPendingVehicleUpdate({ rows: updateRows });
        setShowUpdateModal(true);
        aiDebugLog("vehicle_update", "proposal_detected", {
          fields: updateRows.map((row) => row.field),
        });
        appendChatMessages({
          id: aiMessageId,
          role: "ai",
          text: "I found profile updates. Please review the popup to confirm or cancel.",
          sources: sourcesForMessage,
          videos: videosForMessage,
        });
      } else {
        appendChatMessages({
          id: aiMessageId,
          role: "ai",
          text: safeAssistantMessage,
          sources: sourcesForMessage,
          videos: videosForMessage,
        });
      }

      if (preparedVideoPayload) {
        const backgroundVideoTask = resolveGroundedVideosInBackground(
          preparedVideoPayload.videos,
          preparedVideoPayload.nextThumbnailCache,
          preparedVideoPayload.nextVideoRedirectCache,
          {
            onProgress: ({ sourceUrl, resolvedVideo, removed }) => {
              updateChatMessageById(aiMessageId, (message) => {
                const currentVideos = Array.isArray(message.videos) ? message.videos : [];
                if (currentVideos.length === 0) {
                  return message;
                }

                const matchBySource = (video) =>
                  String(video?.sourceUrl || video?.url || "").trim() ===
                  String(sourceUrl || "").trim();

                let nextVideos = currentVideos;
                if (removed) {
                  nextVideos = currentVideos.filter((video) => !matchBySource(video));
                } else if (resolvedVideo) {
                  let replaced = false;
                  nextVideos = currentVideos.map((video) => {
                    if (matchBySource(video)) {
                      replaced = true;
                      return resolvedVideo;
                    }
                    return video;
                  });
                  if (!replaced) {
                    nextVideos = currentVideos;
                  }
                }

                if (nextVideos === currentVideos) {
                  return message;
                }

                return {
                  ...message,
                  videos: nextVideos,
                };
              });
            },
          }
        );

        backgroundVideoTask
          .then(
            ({
              videos,
              nextThumbnailCache,
              nextVideoRedirectCache,
              thumbnailCacheChanged,
              videoRedirectCacheChanged,
            }) => {
              updateChatMessageById(aiMessageId, (message) => ({
                ...message,
                videos,
              }));

              if (thumbnailCacheChanged) {
                setVideoThumbnailCache(nextThumbnailCache);
                saveValueWithFallback(STORAGE_KEYS.aiVideoThumbnailCache, nextThumbnailCache);
              }

              if (videoRedirectCacheChanged) {
                setVideoRedirectCache(nextVideoRedirectCache);
                saveValueWithFallback(
                  STORAGE_KEYS.aiVideoRedirectCache,
                  nextVideoRedirectCache
                );
              }
            }
          )
          .catch((videoError) => {
            aiDebugError("videos", "background_resolution_failed", videoError);
          });
      }
    } catch (error) {
      setStatus(error.message || "Failed to call Gemini API.");
      aiDebugError("send", "request_failed", error);
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
          debugEnabledInput={debugEnabledInput}
          onDebugEnabledChange={setDebugEnabledInput}
          popupThumbnailsEnabledInput={popupThumbnailsEnabledInput}
          onPopupThumbnailsEnabledChange={handlePopupThumbnailsEnabledChange}
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
