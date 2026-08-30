import { Streamdown } from "streamdown";
import {
  AlertCircle,
  Check,
  ChevronDown,
  CircleStop,
  Clipboard,
  Cloud,
  Code2,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Plus,
  RefreshCcw,
  RotateCcw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildMarkdownExport } from "@shared/chatUtils";
import { runStreamSession } from "@/lib/streamSession";

type ProviderType = "router-openai" | "openai" | "anthropic" | "custom";
type ConnectionStatus = "idle" | "testing" | "connected" | "error";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
};

type Conversation = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  model: string;
  messages: ChatMessage[];
};

type ConnectionMeta = {
  name: string;
  provider: ProviderType;
  baseUrl: string;
  defaultModel: string;
  customProtocol?: "openai" | "anthropic";
};

type ModelOption = {
  id: string;
  ownedBy?: string;
};

const CHAT_STORAGE_KEY = "router-chat-studio:conversations";
const PREFS_STORAGE_KEY = "router-chat-studio:preferences";
const providerLabels: Record<ProviderType, string> = {
  "router-openai": "9Router / OpenAI Compatible",
  openai: "OpenAI Compatible",
  anthropic: "Anthropic Compatible",
  custom: "Custom",
};

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createConversation(model: string): Conversation {
  const now = Date.now();
  return {
    id: uid("chat"),
    title: "Untitled transmission",
    createdAt: now,
    updatedAt: now,
    model,
    messages: [],
  };
}

function formatRelativeTime(timestamp: number) {
  const seconds = Math.max(1, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function exportConversation(conversation: Conversation) {
  const blob = new Blob([buildMarkdownExport(conversation)], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${conversation.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "router-chat"}.md`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function getStoredConversations() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) || "[]") as Conversation[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

function getStoredPrefs(): ConnectionMeta {
  try {
    const parsed = JSON.parse(localStorage.getItem(PREFS_STORAGE_KEY) || "null") as Partial<ConnectionMeta> | null;
    return {
      name: parsed?.name || "Primary connection",
      provider: parsed?.provider || "router-openai",
      baseUrl: parsed?.baseUrl || "http://localhost:9000/v1",
      defaultModel: parsed?.defaultModel || "claude-sonnet-4-6",
      customProtocol: parsed?.customProtocol === "anthropic" ? "anthropic" : "openai",
    };
  } catch {
    return {
      name: "Primary connection",
      provider: "router-openai",
      baseUrl: "http://localhost:9000/v1",
      defaultModel: "claude-sonnet-4-6",
      customProtocol: "openai",
    };
  }
}

export default function Home() {
  const [preferences, setPreferences] = useState<ConnectionMeta>(() => getStoredPrefs());
  const [conversations, setConversations] = useState<Conversation[]>(() => getStoredConversations() || [createConversation("claude-sonnet-4-6")]);
  const [activeId, setActiveId] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isModelPickerOpen, setIsModelPickerOpen] = useState(false);
  const [conversationSearch, setConversationSearch] = useState("");
  const [modelSearch, setModelSearch] = useState("");
  const [manualModelId, setManualModelId] = useState("");
  const [input, setInput] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle");
  const [connectionMessage, setConnectionMessage] = useState("Not connected");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [rememberConnection, setRememberConnection] = useState(() => Boolean(localStorage.getItem(PREFS_STORAGE_KEY)));
  const [draftConnection, setDraftConnection] = useState<ConnectionMeta & { apiKey: string; remember: boolean }>(() => ({ ...getStoredPrefs(), apiKey: "", remember: Boolean(localStorage.getItem(PREFS_STORAGE_KEY)) }));
  const [showApiKey, setShowApiKey] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const messageStageRef = useRef<HTMLDivElement | null>(null);
  const userScrolledRef = useRef(false);

  useEffect(() => {
    if (!activeId && conversations[0]) setActiveId(conversations[0].id);
    setHydrated(true);
  }, [activeId, conversations]);

  useEffect(() => {
    if (!isSettingsOpen && !isModelPickerOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsSettingsOpen(false);
        setIsModelPickerOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSettingsOpen, isModelPickerOpen]);

  useEffect(() => {
    if (hydrated) localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(conversations));
  }, [conversations, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    if (rememberConnection) localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(preferences));
    else localStorage.removeItem(PREFS_STORAGE_KEY);
  }, [preferences, hydrated, rememberConnection]);

  const activeConversation = conversations.find(conversation => conversation.id === activeId) || conversations[0];
  const latestMessageContent = activeConversation?.messages.at(-1)?.content || "";

  useEffect(() => {
    const stage = messageStageRef.current;
    if (!stage || !activeConversation?.messages.length || userScrolledRef.current) return;
    stage.scrollTop = stage.scrollHeight;
  }, [activeConversation?.id, activeConversation?.messages.length, latestMessageContent, isStreaming]);

  const filteredConversations = useMemo(() => {
    const query = conversationSearch.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter(conversation => `${conversation.title} ${conversation.model}`.toLowerCase().includes(query));
  }, [conversationSearch, conversations]);
  const filteredModels = useMemo(() => {
    const query = modelSearch.trim().toLowerCase();
    return models.filter(model => model.id.toLowerCase().includes(query) || model.ownedBy?.toLowerCase().includes(query));
  }, [modelSearch, models]);

  function updateConversation(id: string, updater: (conversation: Conversation) => Conversation) {
    setConversations(current => current.map(conversation => conversation.id === id ? updater(conversation) : conversation));
  }

  function createNewChat() {
    const next = createConversation(preferences.defaultModel || models[0]?.id || "");
    setConversations(current => [next, ...current]);
    setActiveId(next.id);
    userScrolledRef.current = false;
    setErrorMessage("");
    setInput("");
    setIsSidebarOpen(false);
    window.setTimeout(() => composerRef.current?.focus(), 40);
  }

  function selectConversation(id: string) {
    setActiveId(id);
    userScrolledRef.current = false;
    setErrorMessage("");
    setIsSidebarOpen(false);
  }

  function selectModel(modelId: string) {
    if (!activeConversation) return;
    updateConversation(activeConversation.id, conversation => ({ ...conversation, model: modelId, updatedAt: Date.now() }));
    setPreferences(current => ({ ...current, defaultModel: modelId }));
    setIsModelPickerOpen(false);
    setModelSearch("");
    setManualModelId("");
  }

  function clearConversation() {
    if (!activeConversation) return;
    updateConversation(activeConversation.id, conversation => ({ ...conversation, title: "Untitled transmission", messages: [], updatedAt: Date.now() }));
    setErrorMessage("");
  }

  async function copyMessage(content: string) {
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      setErrorMessage("Clipboard access is unavailable in this browser.");
    }
  }

  async function startStream(conversationId: string, messageList: ChatMessage[], model: string) {
    setIsStreaming(true);
    setErrorMessage("");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await runStreamSession({
        model,
        messages: messageList,
        signal: controller.signal,
        createId: () => uid("assistant"),
        onUpdate: nextMessages => {
          const assistant = nextMessages.find(message => message.role === "assistant" && message.id !== messageList.find(item => item.role === "assistant")?.id);
          if (assistant) setStreamingMessageId(assistant.id);
          updateConversation(conversationId, conversation => ({
            ...conversation,
            messages: nextMessages as ChatMessage[],
            updatedAt: Date.now(),
            title: conversation.title === "Untitled transmission" ? (messageList.find(message => message.role === "user")?.content.slice(0, 38) || conversation.title) : conversation.title,
          }));
        },
      });
    } catch (error) {
      if ((error as Error).name !== "AbortError") setErrorMessage(error instanceof Error ? error.message : "The provider request failed.");
    } finally {
      abortRef.current = null;
      setStreamingMessageId(null);
      setIsStreaming(false);
    }
  }

  function handleSend() {
    const content = input.trim();
    if (!content || !activeConversation || isStreaming) return;
    if (connectionStatus !== "connected") {
      setIsSettingsOpen(true);
      setErrorMessage("Connect a provider before sending a transmission.");
      return;
    }
    const userMessage: ChatMessage = { id: uid("user"), role: "user", content, createdAt: Date.now() };
    userScrolledRef.current = false;
    setInput("");
    void startStream(activeConversation.id, [...activeConversation.messages, userMessage], activeConversation.model);
  }

  function stopGeneration() {
    abortRef.current?.abort();
    setIsStreaming(false);
    setStreamingMessageId(null);
  }

  function regenerate() {
    if (!activeConversation || isStreaming) return;
    const lastAssistantIndex = [...activeConversation.messages].reverse().findIndex(message => message.role === "assistant");
    if (lastAssistantIndex === -1) return;
    const actualIndex = activeConversation.messages.length - 1 - lastAssistantIndex;
    const baseMessages = activeConversation.messages.slice(0, actualIndex);
    const lastUser = [...baseMessages].reverse().find(message => message.role === "user");
    if (!lastUser) return;
    void startStream(activeConversation.id, baseMessages, activeConversation.model);
  }

  async function testConnection() {
    setConnectionStatus("testing");
    setConnectionMessage("Checking endpoint…");
    setErrorMessage("");
    try {
      const response = await fetch("/api/connection/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftConnection),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Connection test failed.");
      setModels(body.models || []);
      setConnectionStatus("connected");
      setConnectionMessage(body.models?.length ? `${body.models.length} models discovered` : "Connected · enter a model ID manually");
    } catch (error) {
      setConnectionStatus("error");
      setConnectionMessage("Connection failed");
      setErrorMessage(error instanceof Error ? error.message : "Connection test failed.");
    }
  }

  async function saveConnection() {
    if (!draftConnection.apiKey.trim()) {
      setErrorMessage("Enter an API key to activate this connection. It is kept in server memory for this session.");
      return;
    }
    try {
      const response = await fetch("/api/connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftConnection),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Connection could not be saved.");
      setPreferences({ name: draftConnection.name, provider: draftConnection.provider, baseUrl: draftConnection.baseUrl, defaultModel: draftConnection.defaultModel, customProtocol: draftConnection.customProtocol });
      setRememberConnection(draftConnection.remember);
      setConnectionStatus("connected");
      setConnectionMessage("Session connected");
      setIsSettingsOpen(false);
      setErrorMessage("");
    } catch (error) {
      setConnectionStatus("error");
      setConnectionMessage("Connection failed");
      setErrorMessage(error instanceof Error ? error.message : "Connection could not be saved.");
    }
  }

  async function refreshModels() {
    try {
      const response = await fetch("/api/models");
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Models could not be refreshed.");
      setModels(body.models || []);
      setConnectionMessage(body.models?.length ? `${body.models.length} models discovered` : "Connected · enter a model ID manually");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Models could not be refreshed.");
    }
  }

  function updateDraft<K extends keyof typeof draftConnection>(key: K, value: (typeof draftConnection)[K]) {
    setDraftConnection(current => ({ ...current, [key]: value }));
  }

  const statusTone = connectionStatus === "connected" ? "connected" : connectionStatus === "error" ? "error" : connectionStatus === "testing" ? "testing" : "idle";
  const activeModel = activeConversation?.model || preferences.defaultModel || "Choose a model";

  return (
    <main className="studio-shell">
      <div className="orbit orbit-one" />
      <div className="orbit orbit-two" />
      <div className="orbit orbit-three" />
      <div className="grid-sheen" />

      <section className={`app-frame ${isSidebarOpen ? "sidebar-mobile-open" : ""}`}>
        <aside className="sidebar-panel">
          <div className="sidebar-brand">
            <div className="brand-mark"><Sparkles size={15} strokeWidth={2.5} /></div>
            <div>
              <div className="brand-name">ROUTER<span>CHAT</span></div>
              <div className="brand-caption">LOCAL TRANSMISSION DECK</div>
            </div>
            <button className="icon-button sidebar-close" onClick={() => setIsSidebarOpen(false)} aria-label="Close sidebar"><X size={17} /></button>
          </div>

          <button className="new-chat-button" onClick={createNewChat}><Plus size={17} strokeWidth={2.5} /><span>New chat</span><kbd>⌘ N</kbd></button>

          <div className="sidebar-section-label"><span>Conversations</span><span className="count-pill">{conversations.length}</span></div>
          <label className="sidebar-search">
            <Search size={15} />
            <input value={conversationSearch} onChange={event => setConversationSearch(event.target.value)} placeholder="Search chats" aria-label="Search conversations" />
            {conversationSearch && <button onClick={() => setConversationSearch("")} aria-label="Clear search"><X size={13} /></button>}
          </label>

          <div className="conversation-list">
            {filteredConversations.map(conversation => (
              <button key={conversation.id} className={`conversation-item ${conversation.id === activeConversation?.id ? "active" : ""}`} onClick={() => selectConversation(conversation.id)}>
                <span className="conversation-icon"><MessageSquare size={15} /></span>
                <span className="conversation-copy"><strong>{conversation.title}</strong><small>{conversation.messages.length ? `${conversation.messages.length} messages · ` : "Ready · "}{formatRelativeTime(conversation.updatedAt)}</small></span>
                <MoreHorizontal size={15} className="conversation-more" />
              </button>
            ))}
            {!filteredConversations.length && <div className="sidebar-empty"><FileText size={21} /><span>No transmissions found.</span></div>}
          </div>

          <div className="sidebar-footer">
            <div className="security-note"><ShieldCheck size={16} /><span>Keys stay server-side<br /><small>Session memory · never local</small></span></div>
            <button className="settings-nav" onClick={() => setIsSettingsOpen(true)}><Settings2 size={16} /><span>Connection settings</span><ChevronDown size={14} /></button>
          </div>
        </aside>

        <div className="main-panel">
          <header className="topbar">
            <div className="topbar-left">
              <button className="icon-button menu-button" onClick={() => setIsSidebarOpen(true)} aria-label="Open sidebar"><Menu size={19} /></button>
              <div className="mobile-title"><span className="brand-name">ROUTER<span>CHAT</span></span><span className="mobile-divider">/</span><span>LIVE DECK</span></div>
              <div className="desktop-crumb"><span>Workspace</span><span className="crumb-slash">/</span><strong>Conversation deck</strong></div>
            </div>
            <div className="topbar-right">
              <div className={`connection-chip ${statusTone}`}><span className="status-dot" /><span>{connectionMessage}</span></div>
              <button className="topbar-settings" onClick={() => setIsSettingsOpen(true)}><Settings2 size={16} /><span>Settings</span></button>
            </div>
          </header>

          <div className="workspace-body">
            <div className="workspace-heading">
              <div>
                <div className="eyebrow"><span className="eyebrow-slash" />ACTIVE TRANSMISSION</div>
                <h1>{activeConversation?.messages.length ? activeConversation.title : "What will you transmit?"}</h1>
                <p>{activeConversation?.messages.length ? "Your thread is preserved locally and ready to continue." : "Configure your route, choose a model, and make the first move."}</p>
              </div>
              <div className="heading-actions">
                <button className="subtle-action" onClick={() => activeConversation && exportConversation(activeConversation)} disabled={!activeConversation?.messages.length}><Download size={15} /> Export .md</button>
                <button className="subtle-icon" onClick={clearConversation} disabled={!activeConversation?.messages.length} aria-label="Clear conversation"><Trash2 size={16} /></button>
              </div>
            </div>

            <div className="message-stage" ref={messageStageRef} onScroll={event => { const stage = event.currentTarget; userScrolledRef.current = stage.scrollHeight - stage.scrollTop - stage.clientHeight > 90; }}>
              {!activeConversation?.messages.length ? (
                <div className="empty-state">
                  <div className="signal-icon"><Zap size={25} fill="currentColor" /></div>
                  <div className="empty-kicker">READY WHEN YOU ARE</div>
                  <h2>Send a thought<br /><span>into the signal.</span></h2>
                  <p>One focused surface for multi-turn work across the models you already use.</p>
                  <div className="prompt-row">
                    <button onClick={() => setInput("Summarize the key ideas in this document")}>Summarize a document <span>↗</span></button>
                    <button onClick={() => setInput("Help me think through a difficult decision")}>Think it through <span>↗</span></button>
                    <button onClick={() => setInput("Draft a clear plan for my next project")}>Draft a plan <span>↗</span></button>
                  </div>
                </div>
              ) : (
                <div className="message-list">
                  {activeConversation.messages.map((message, index) => (
                    <article className={`message-row ${message.role}`} key={message.id}>
                      <div className={`avatar ${message.role}`}>{message.role === "user" ? "Y" : <Sparkles size={15} />}</div>
                      <div className="message-content">
                        <div className="message-meta"><span>{message.role === "user" ? "YOU" : "ROUTERCHAT"}</span><span className="meta-divider">·</span><time>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></div>
                        <div className={`message-bubble ${message.role === "assistant" ? "markdown-body" : "user-bubble"}`}>
                          {message.content ? (message.role === "assistant" ? <Streamdown>{message.content}</Streamdown> : <p>{message.content}</p>) : <div className="typing-indicator"><span /><span /><span /></div>}
                        </div>
                        {message.role === "assistant" && message.content && <div className="message-actions"><button onClick={() => void copyMessage(message.content)}><Copy size={13} /> Copy</button>{index === activeConversation.messages.length - 1 && <button onClick={regenerate}><RotateCcw size={13} /> Regenerate</button>}</div>}
                      </div>
                    </article>
                  ))}
                  {isStreaming && <div className="streaming-label"><span className="status-dot connected" />Streaming response <button onClick={stopGeneration}><CircleStop size={14} /> Stop</button></div>}
                </div>
              )}
            </div>

            <div className="composer-wrap">
              {errorMessage && <div className="error-banner"><AlertCircle size={15} /><span>{errorMessage}</span><button onClick={() => setErrorMessage("")} aria-label="Dismiss error"><X size={14} /></button></div>}
              <div className="composer-shell">
                <div className="composer-toolbar">
                  <div className="model-picker-wrap">
                    <button className="model-trigger" onClick={() => setIsModelPickerOpen(current => !current)} aria-expanded={isModelPickerOpen} aria-haspopup="dialog"><span className="model-signal" /><span className="model-trigger-label"><small>MODEL</small><strong>{activeModel}</strong></span><ChevronDown size={16} /></button>
                    {isModelPickerOpen && <div className="model-popover">
                      <div className="popover-heading"><div><strong>Choose a model</strong><small>{models.length} available in this workspace</small></div><button onClick={() => setIsModelPickerOpen(false)} aria-label="Close model picker"><X size={15} /></button></div>
                      <label className="model-search"><Search size={14} /><input autoFocus value={modelSearch} onChange={event => setModelSearch(event.target.value)} placeholder="Search model IDs" /></label>
                      <div className="model-options">{filteredModels.map(model => <button key={model.id} className={`model-option ${model.id === activeModel ? "selected" : ""}`} onClick={() => selectModel(model.id)}><span className="model-option-mark">{model.id === activeModel ? <Check size={13} /> : <Code2 size={13} />}</span><span><strong>{model.id}</strong><small>{model.ownedBy || "compatible endpoint"}</small></span></button>)}{!filteredModels.length && <div className="model-empty">No matching models from this endpoint. Use the manual ID field below.</div>}</div>
                      <div className="manual-model-row"><input value={manualModelId} onChange={event => setManualModelId(event.target.value)} placeholder="Enter model ID manually" aria-label="Manual model ID" /><button onClick={() => { const nextModel = manualModelId.trim(); if (!nextModel) return; setModels(current => current.some(model => model.id === nextModel) ? current : [...current, { id: nextModel, ownedBy: "manual" }]); selectModel(nextModel); }}>Use ID</button></div>
                      <div className="popover-foot"><button onClick={() => { setIsModelPickerOpen(false); setIsSettingsOpen(true); }}><Settings2 size={13} /> Manage connection</button><button onClick={() => void refreshModels()}><RefreshCcw size={13} /> Refresh</button></div>
                    </div>}
                  </div>
                  <div className="composer-hint"><span className="desktop-only">Markdown supported</span><span className="hint-divider" /><kbd>↵</kbd> to send</div>
                </div>
                <textarea ref={composerRef} value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); handleSend(); } }} placeholder="Transmit a message…" rows={2} aria-label="Message composer" />
                <div className="composer-bottom"><span className="composer-footnote"><KeyRound size={12} /> {connectionStatus === "connected" ? "Secure session active" : "Connect a provider to begin"}</span><button className="send-button" onClick={isStreaming ? stopGeneration : handleSend} disabled={!input.trim() && !isStreaming}>{isStreaming ? <><CircleStop size={16} /> Stop</> : <><Send size={15} /> Send</>}</button></div>
              </div>
              <div className="composer-disclaimer"><span>ROUTERCHAT LOCAL CLIENT</span><span>YOUR API · YOUR ROUTE · YOUR THREADS</span></div>
            </div>
          </div>
        </div>
      </section>

      {isSettingsOpen && <div className="modal-backdrop" onMouseDown={event => { if (event.currentTarget === event.target) setIsSettingsOpen(false); }}>
        <section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
          <div className="modal-header"><div><div className="eyebrow"><span className="eyebrow-slash" />ROUTE CONFIGURATION</div><h2 id="settings-title">Connection settings</h2><p>Keep credentials out of the browser. The local server holds the active key in session memory.</p></div><button className="icon-button" onClick={() => setIsSettingsOpen(false)} aria-label="Close settings"><X size={18} /></button></div>
          <div className="settings-form">
            <label><span>Connection name</span><input value={draftConnection.name} onChange={event => updateDraft("name", event.target.value)} placeholder="Primary connection" /></label>
            <label><span>Provider type</span><select value={draftConnection.provider} onChange={event => updateDraft("provider", event.target.value as ProviderType)}>{Object.entries(providerLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
            {draftConnection.provider === "custom" && <label><span>Custom protocol</span><select value={draftConnection.customProtocol || "openai"} onChange={event => updateDraft("customProtocol", event.target.value as "openai" | "anthropic")}><option value="openai">OpenAI-compatible</option><option value="anthropic">Anthropic-compatible</option></select></label>}
            <label className="wide"><span>9Router / API base URL</span><div className="input-with-icon"><Cloud size={15} /><input value={draftConnection.baseUrl} onChange={event => updateDraft("baseUrl", event.target.value)} placeholder="http://localhost:9000/v1" /></div><small>Use the endpoint exposed by your local router. /v1 is added when omitted.</small></label>
            <label className="wide"><span>API key</span><div className="input-with-icon"><KeyRound size={15} /><input type={showApiKey ? "text" : "password"} value={draftConnection.apiKey} onChange={event => updateDraft("apiKey", event.target.value)} placeholder="Paste a key for this session" /><button type="button" onClick={() => setShowApiKey(current => !current)} aria-label={showApiKey ? "Hide API key" : "Show API key"}>{showApiKey ? <EyeOff size={15} /> : <Eye size={15} />}</button></div><small>Never logged, stored in localStorage, or sent to the frontend.</small></label>
            <label><span>Default model ID</span><input value={draftConnection.defaultModel} onChange={event => updateDraft("defaultModel", event.target.value)} placeholder="claude-sonnet-4-6" /></label>
            <div className="remember-row"><button className={`toggle ${draftConnection.remember ? "on" : ""}`} onClick={() => updateDraft("remember", !draftConnection.remember)} aria-pressed={draftConnection.remember}><span /></button><div><strong>Remember connection preferences</strong><small>Save name, provider, URL, and model on this computer. The API key is never saved.</small></div></div>
          </div>
          <div className={`settings-status ${statusTone}`}><span className="status-dot" /><div><strong>{connectionStatus === "testing" ? "Checking connection" : connectionStatus === "connected" ? "Connection ready" : connectionStatus === "error" ? "Connection needs attention" : "Not tested"}</strong><small>{connectionMessage}</small></div>{connectionStatus === "connected" && <Check size={17} />}</div>
          <div className="modal-actions"><button className="secondary-button" onClick={() => void testConnection()} disabled={connectionStatus === "testing"}><RefreshCcw size={15} className={connectionStatus === "testing" ? "spin" : ""} /> {connectionStatus === "testing" ? "Checking…" : "Check connection"}</button><button className="primary-button" onClick={() => void saveConnection()}><ShieldCheck size={15} /> Save & connect</button></div>
          <div className="modal-tip"><Clipboard size={14} /><span>Compatible with OpenAI-style <code>/v1/chat/completions</code> and Anthropic-style <code>/v1/messages</code> routes.</span></div>
        </section>
      </div>}
    </main>
  );
}
