"use client";
import { useState, useEffect, useRef } from "react";

const T = {
  bg: "#0D1426",
  navy: "#080f1e",
  orange: "#E86A2A",
  text: "#e8eaf0",
  muted: "#b0b4c8",
  surface: "#111827",
  border: "rgba(255,255,255,0.07)",
  green: "#2ecc71",
  red: "#e74c3c",
};

interface LandingPage {
  id: string;
  name: string;
  slug: string;
  custom_domain: string | null;
  html_content: string | null;
  css_content: string | null;
  published: boolean;
  visits: number;
  conversions: number;
  created_at: string;
  updated_at: string;
}

interface ChatMessage {
  role: "assistant" | "user";
  content: string;
}

const AI_QUESTIONS = [
  "What's your business name?",
  "What do you do? What services or products do you offer?",
  "Who's your ideal customer? Who are you trying to reach?",
  "What do you want visitors to do on this page? (book a call, fill out a form, call you, etc.)",
  "What's your phone number?",
  "What's your email address?",
  "What's your business address? (or just city/state if you prefer)",
  "Do you have a logo URL? (paste a link, or type 'no' and we'll use text)",
  "What's your headline? Something catchy, or I can come up with one for you",
  "What colors do you want? (your brand colors, or describe the vibe like 'dark and professional' or 'bright and friendly')",
  "Any testimonials or reviews you want on the page? (paste them or type 'skip')",
  "Anything else you want on there? Hours, special offers, guarantees, etc.",
  "Any websites you like the look of? Drop 2 or 3 links for inspiration (or type 'skip')",
];

const ANSWER_KEYS = ["businessName", "services", "audience", "cta", "phone", "email", "address", "logo", "headline", "colors", "testimonials", "extras", "inspiration"];

export default function WebsitesPage() {
  const [pages, setPages] = useState<LandingPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPage, setEditingPage] = useState<LandingPage | null>(null);
  const [showDomainModal, setShowDomainModal] = useState<LandingPage | null>(null);
  const [revisionPage, setRevisionPage] = useState<LandingPage | null>(null);
  const [revisionInput, setRevisionInput] = useState("");
  const [revising, setRevising] = useState(false);

  useEffect(() => {
    fetchPages();
  }, []);

  async function fetchPages() {
    try {
      const res = await fetch("/api/websites");
      const data = await res.json();
      setPages(data.pages || []);
    } catch (e) {
      console.error("Failed to fetch pages", e);
    } finally {
      setLoading(false);
    }
  }

  async function togglePublish(page: LandingPage) {
    try {
      await fetch(`/api/websites/${page.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: !page.published }),
      });
      fetchPages();
    } catch (e) {
      console.error("Failed to toggle publish", e);
    }
  }

  async function deletePage(page: LandingPage) {
    if (!confirm(`Delete "${page.name}"? This cannot be undone.`)) return;
    try {
      await fetch(`/api/websites/${page.id}`, { method: "DELETE" });
      fetchPages();
    } catch (e) {
      console.error("Failed to delete page", e);
    }
  }

  return (
    <div>
      <style>{`
        .wp-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 28px; }
        .wp-title { font-family: 'Bebas Neue', sans-serif; font-size: 28px; color: ${T.text}; letter-spacing: 1.5px; }
        .wp-subtitle { font-size: 13px; color: ${T.muted}; margin-top: 2px; }
        .wp-btn { padding: 10px 20px; background: ${T.orange}; color: #fff; border: none; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; transition: all 0.15s; }
        .wp-btn:hover { opacity: 0.9; transform: translateY(-1px); }
        .wp-btn-sm { padding: 6px 12px; font-size: 11px; border-radius: 6px; }
        .wp-btn-ghost { background: transparent; border: 1px solid ${T.border}; color: ${T.muted}; }
        .wp-btn-ghost:hover { border-color: ${T.orange}; color: ${T.orange}; background: transparent; }
        .wp-btn-green { background: ${T.green}; }
        .wp-btn-red { background: transparent; border: 1px solid ${T.red}; color: ${T.red}; }
        .wp-btn-red:hover { background: ${T.red}; color: #fff; }
        .wp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 20px; }
        .wp-card { background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 12px; overflow: hidden; transition: all 0.2s; }
        .wp-card:hover { border-color: rgba(255,255,255,0.12); transform: translateY(-2px); box-shadow: 0 8px 32px rgba(0,0,0,0.3); }
        .wp-card-preview { height: 160px; background: ${T.navy}; border-bottom: 1px solid ${T.border}; display: flex; align-items: center; justify-content: center; overflow: hidden; position: relative; }
        .wp-card-preview iframe { width: 200%; height: 200%; transform: scale(0.5); transform-origin: top left; border: none; pointer-events: none; }
        .wp-card-body { padding: 16px; }
        .wp-card-name { font-size: 15px; font-weight: 700; color: ${T.text}; margin-bottom: 4px; }
        .wp-card-url { font-size: 11px; color: ${T.muted}; font-family: monospace; margin-bottom: 12px; word-break: break-all; }
        .wp-card-stats { display: flex; gap: 16px; margin-bottom: 14px; }
        .wp-card-stat { font-size: 11px; color: ${T.muted}; }
        .wp-card-stat strong { color: ${T.text}; font-size: 15px; display: block; margin-bottom: 2px; }
        .wp-badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
        .wp-badge-live { background: rgba(46,204,113,0.12); color: ${T.green}; }
        .wp-badge-draft { background: rgba(176,180,200,0.1); color: ${T.muted}; }
        .wp-card-actions { display: flex; gap: 6px; flex-wrap: wrap; }
        .wp-empty { text-align: center; padding: 60px 20px; }
        .wp-empty-icon { font-size: 48px; margin-bottom: 16px; opacity: 0.5; }
        .wp-empty-text { font-size: 15px; color: ${T.muted}; margin-bottom: 20px; }
        .wp-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 300; display: flex; align-items: center; justify-content: center; }
        .wp-modal { background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 16px; width: 90%; max-width: 600px; max-height: 90vh; display: flex; flex-direction: column; overflow: hidden; }
        .wp-modal-header { padding: 20px 24px 16px; border-bottom: 1px solid ${T.border}; display: flex; justify-content: space-between; align-items: center; }
        .wp-modal-title { font-family: 'Bebas Neue', sans-serif; font-size: 20px; color: ${T.text}; letter-spacing: 1px; }
        .wp-modal-close { background: none; border: none; color: ${T.muted}; font-size: 20px; cursor: pointer; }
        .wp-modal-body { flex: 1; overflow-y: auto; padding: 0; }
        .wp-edit-modal { max-width: 900px; height: 80vh; }
        .wp-domain-modal { max-width: 480px; }
      `}</style>

      <div className="wp-header">
        <div>
          <div className="wp-title">Websites</div>
          <div className="wp-subtitle">Build and manage landing pages with AI</div>
        </div>
        <button className="wp-btn" onClick={() => setShowModal(true)}>
          + Create New Website
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: T.muted }}>Loading...</div>
      ) : pages.length === 0 ? (
        <div className="wp-empty">
          <div className="wp-empty-icon">🌐</div>
          <div className="wp-empty-text">No landing pages yet. Create your first one with AI!</div>
          <button className="wp-btn" onClick={() => setShowModal(true)}>
            + Create New Website
          </button>
        </div>
      ) : (
        <div className="wp-grid">
          {pages.map((page) => (
            <div key={page.id} className="wp-card">
              <div className="wp-card-preview">
                {page.html_content ? (
                  <iframe
                    srcDoc={page.html_content}
                    sandbox=""
                    title={page.name}
                  />
                ) : (
                  <span style={{ color: T.muted, fontSize: 13 }}>No content yet</span>
                )}
              </div>
              <div className="wp-card-body">
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <div className="wp-card-name">{page.name}</div>
                  <span className={`wp-badge ${page.published ? "wp-badge-live" : "wp-badge-draft"}`}>
                    {page.published ? "Live" : "Draft"}
                  </span>
                </div>
                <div className="wp-card-url">
                  thewolfpack.ai/s/{page.slug}
                  {page.custom_domain && (
                    <span style={{ marginLeft: 8, color: T.green }}>| {page.custom_domain}</span>
                  )}
                </div>
                <div className="wp-card-stats">
                  <div className="wp-card-stat">
                    <strong>{page.visits || 0}</strong>Visits
                  </div>
                  <div className="wp-card-stat">
                    <strong>{page.conversions || 0}</strong>Conversions
                  </div>
                  <div className="wp-card-stat">
                    <strong>{page.visits ? ((page.conversions / page.visits) * 100).toFixed(1) + "%" : "—"}</strong>Conv. Rate
                  </div>
                </div>
                <div className="wp-card-actions">
                  <button
                    className={`wp-btn wp-btn-sm ${page.published ? "wp-btn-ghost" : "wp-btn-green"}`}
                    onClick={() => togglePublish(page)}
                  >
                    {page.published ? "Unpublish" : "Publish"}
                  </button>
                  <a
                    href={`/s/${page.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="wp-btn wp-btn-sm wp-btn-ghost"
                    style={{ textDecoration: "none", textAlign: "center" }}
                  >
                    Preview
                  </a>
                  <button
                    className="wp-btn wp-btn-sm wp-btn-ghost"
                    onClick={() => setRevisionPage(page)}
                  >
                    Make Changes
                  </button>
                  <button
                    className="wp-btn wp-btn-sm wp-btn-ghost"
                    onClick={() => setEditingPage(page)}
                  >
                    Edit Code
                  </button>
                  <button
                    className="wp-btn wp-btn-sm wp-btn-ghost"
                    onClick={() => setShowDomainModal(page)}
                  >
                    Domain
                  </button>
                  <button
                    className="wp-btn wp-btn-sm wp-btn-red"
                    onClick={() => deletePage(page)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <CreateModal
          onClose={() => setShowModal(false)}
          onCreated={() => {
            setShowModal(false);
            fetchPages();
          }}
        />
      )}

      {editingPage && (
        <EditModal
          page={editingPage}
          onClose={() => setEditingPage(null)}
          onSaved={() => {
            setEditingPage(null);
            fetchPages();
          }}
        />
      )}

      {showDomainModal && (
        <DomainModal
          page={showDomainModal}
          onClose={() => setShowDomainModal(null)}
        />
      )}

      {/* Revision Modal */}
      {revisionPage && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => !revising && setRevisionPage(null)}>
          <div style={{ width: 600, maxWidth: "95vw", maxHeight: "90vh", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "18px 24px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: T.text }}>MAKE CHANGES</div>
              <button onClick={() => setRevisionPage(null)} style={{ background: "none", border: "none", color: T.muted, fontSize: 20, cursor: "pointer" }}>×</button>
            </div>

            {/* Preview */}
            <div style={{ flex: 1, overflow: "hidden", borderBottom: `1px solid ${T.border}` }}>
              {revisionPage.html_content ? (
                <iframe
                  srcDoc={revisionPage.html_content}
                  style={{ width: "100%", height: "100%", border: "none", minHeight: 300 }}
                  sandbox="allow-scripts"
                />
              ) : (
                <div style={{ padding: 40, textAlign: "center", color: T.muted }}>No page content yet</div>
              )}
            </div>

            {/* Revision Input */}
            <div style={{ padding: "16px 24px" }}>
              <div style={{ fontSize: 12, color: T.muted, marginBottom: 8 }}>Describe what you want to change. Be as specific as you want.</div>
              <textarea
                value={revisionInput}
                onChange={e => setRevisionInput(e.target.value)}
                placeholder="Make the headline bigger, change the button color to blue, add a section about our warranty..."
                style={{
                  width: "100%", padding: "12px 14px", background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${T.border}`, borderRadius: 10, color: T.text, fontSize: 14,
                  resize: "none", outline: "none", minHeight: 80, boxSizing: "border-box",
                  fontFamily: "Inter, sans-serif",
                }}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
                <button
                  onClick={() => setRevisionPage(null)}
                  style={{ padding: "10px 20px", background: "none", border: `1px solid ${T.border}`, borderRadius: 8, color: T.muted, fontSize: 13, cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!revisionInput.trim()) return;
                    setRevising(true);
                    try {
                      const res = await fetch(`/api/websites/${revisionPage.id}/generate`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ revisionRequest: revisionInput }),
                      });
                      const data = await res.json();
                      if (data.html) {
                        setRevisionPage({ ...revisionPage, html_content: data.html });
                        setRevisionInput("");
                        fetchPages();
                      }
                    } catch (e) {
                      console.error(e);
                    }
                    setRevising(false);
                  }}
                  disabled={revising || !revisionInput.trim()}
                  style={{
                    padding: "10px 24px", background: "#E86A2A", color: "#fff", border: "none",
                    borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer",
                    opacity: revising || !revisionInput.trim() ? 0.5 : 1,
                  }}
                >
                  {revising ? "Updating..." : "Apply Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Create Modal with AI Chat ─── */
function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [step, setStep] = useState<"chat" | "generating" | "preview">("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Let's build your landing page! " + AI_QUESTIONS[0] },
  ]);
  const [input, setInput] = useState("");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [generatedHtml, setGeneratedHtml] = useState("");
  const [pageId, setPageId] = useState("");
  const [pageName, setPageName] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!input.trim()) return;
    const userMsg = input.trim();
    setInput("");

    const newAnswers = { ...answers, [ANSWER_KEYS[questionIndex]]: userMsg };
    setAnswers(newAnswers);

    const newMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: userMsg },
    ];

    const nextQ = questionIndex + 1;

    if (nextQ < AI_QUESTIONS.length) {
      newMessages.push({ role: "assistant", content: AI_QUESTIONS[nextQ] });
      setMessages(newMessages);
      setQuestionIndex(nextQ);
    } else {
      // All questions answered — generate
      newMessages.push({
        role: "assistant",
        content: "Got it! I'm generating your landing page now. This will take a moment...",
      });
      setMessages(newMessages);
      setStep("generating");

      // Derive a name and slug from the business answer
      const name = newAnswers.business || "My Landing Page";
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .substring(0, 40);
      setPageName(name);

      try {
        // Create the page first
        const createRes = await fetch("/api/websites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, slug }),
        });
        const createData = await createRes.json();

        if (!createRes.ok) {
          throw new Error(createData.error || "Failed to create page");
        }

        const newPageId = createData.page.id;
        setPageId(newPageId);

        // Generate the page content
        const genRes = await fetch(`/api/websites/${newPageId}/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers: newAnswers }),
        });
        const genData = await genRes.json();

        if (!genRes.ok) {
          throw new Error(genData.error || "Failed to generate page");
        }

        setGeneratedHtml(genData.html || "");
        setStep("preview");
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Your landing page is ready! Check out the preview below.",
          },
        ]);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Something went wrong: ${msg}. Please try again.` },
        ]);
        setStep("chat");
        setQuestionIndex(AI_QUESTIONS.length - 1);
      }
    }
  }

  async function handlePublish() {
    if (!pageId) return;
    try {
      await fetch(`/api/websites/${pageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: true }),
      });
      onCreated();
    } catch (e) {
      console.error("Failed to publish", e);
    }
  }

  return (
    <div className="wp-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="wp-modal" style={{ maxWidth: step === "preview" ? 900 : 600, height: step === "preview" ? "85vh" : undefined }}>
        <div className="wp-modal-header">
          <div className="wp-modal-title">
            {step === "preview" ? pageName : "Create Landing Page"}
          </div>
          <button className="wp-modal-close" onClick={onClose}>x</button>
        </div>

        <div className="wp-modal-body" style={{ display: "flex", flexDirection: "column" }}>
          {/* Chat Messages */}
          <div
            style={{
              flex: step === "preview" ? "none" : 1,
              maxHeight: step === "preview" ? 120 : undefined,
              overflowY: "auto",
              padding: "16px 24px",
            }}
          >
            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    maxWidth: "80%",
                    padding: "10px 14px",
                    borderRadius: 12,
                    fontSize: 13,
                    lineHeight: 1.5,
                    background:
                      msg.role === "user"
                        ? T.orange
                        : "rgba(255,255,255,0.05)",
                    color: msg.role === "user" ? "#fff" : T.text,
                    border:
                      msg.role === "user"
                        ? "none"
                        : `1px solid ${T.border}`,
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {step === "generating" && (
              <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 10 }}>
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: 12,
                    fontSize: 13,
                    background: "rgba(255,255,255,0.05)",
                    color: T.muted,
                    border: `1px solid ${T.border}`,
                  }}
                >
                  Generating your page...
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Preview */}
          {step === "preview" && (
            <div
              style={{
                flex: 1,
                borderTop: `1px solid ${T.border}`,
                background: "#fff",
                position: "relative",
              }}
            >
              <iframe
                srcDoc={generatedHtml}
                style={{ width: "100%", height: "100%", border: "none" }}
                sandbox="allow-scripts"
                title="Preview"
              />
            </div>
          )}

          {/* Input */}
          {step === "chat" && (
            <div
              style={{
                padding: "12px 24px 16px",
                borderTop: `1px solid ${T.border}`,
                display: "flex",
                gap: 8,
              }}
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Type your answer..."
                autoFocus
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${T.border}`,
                  borderRadius: 8,
                  color: T.text,
                  fontSize: 13,
                  outline: "none",
                }}
              />
              <button className="wp-btn" onClick={handleSend}>
                Send
              </button>
            </div>
          )}

          {/* Preview Actions */}
          {step === "preview" && (
            <div
              style={{
                padding: "12px 24px",
                borderTop: `1px solid ${T.border}`,
                display: "flex",
                gap: 8,
                justifyContent: "flex-end",
              }}
            >
              <button className="wp-btn wp-btn-ghost" onClick={onCreated}>
                Save as Draft
              </button>
              <button className="wp-btn wp-btn-green" onClick={handlePublish}>
                Publish Now
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Edit Modal ─── */
function EditModal({
  page,
  onClose,
  onSaved,
}: {
  page: LandingPage;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [html, setHtml] = useState(page.html_content || "");
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"code" | "preview">("preview");

  async function handleSave() {
    setSaving(true);
    try {
      await fetch(`/api/websites/${page.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html_content: html }),
      });
      onSaved();
    } catch (e) {
      console.error("Failed to save", e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="wp-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="wp-modal wp-edit-modal">
        <div className="wp-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div className="wp-modal-title">Edit: {page.name}</div>
            <div style={{ display: "flex", gap: 4 }}>
              <button
                onClick={() => setTab("preview")}
                style={{
                  padding: "4px 12px",
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 600,
                  border: `1px solid ${T.border}`,
                  background: tab === "preview" ? T.orange : "transparent",
                  color: tab === "preview" ? "#fff" : T.muted,
                  cursor: "pointer",
                }}
              >
                Preview
              </button>
              <button
                onClick={() => setTab("code")}
                style={{
                  padding: "4px 12px",
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 600,
                  border: `1px solid ${T.border}`,
                  background: tab === "code" ? T.orange : "transparent",
                  color: tab === "code" ? "#fff" : T.muted,
                  cursor: "pointer",
                }}
              >
                Code
              </button>
            </div>
          </div>
          <button className="wp-modal-close" onClick={onClose}>x</button>
        </div>

        <div className="wp-modal-body" style={{ display: "flex", flexDirection: "column" }}>
          {tab === "code" ? (
            <textarea
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              style={{
                flex: 1,
                padding: 16,
                background: T.navy,
                color: T.text,
                border: "none",
                fontFamily: "monospace",
                fontSize: 12,
                lineHeight: 1.6,
                resize: "none",
                outline: "none",
              }}
            />
          ) : (
            <div style={{ flex: 1, background: "#fff" }}>
              <iframe
                srcDoc={html}
                style={{ width: "100%", height: "100%", border: "none" }}
                sandbox="allow-scripts"
                title="Preview"
              />
            </div>
          )}

          <div
            style={{
              padding: "12px 24px",
              borderTop: `1px solid ${T.border}`,
              display: "flex",
              gap: 8,
              justifyContent: "flex-end",
            }}
          >
            <button className="wp-btn wp-btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button className="wp-btn" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Domain Modal ─── */
function DomainModal({
  page,
  onClose,
}: {
  page: LandingPage;
  onClose: () => void;
}) {
  const [domain, setDomain] = useState(page.custom_domain || "");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{
    message: string;
    dns: { type: string; name: string; value: string }[];
  } | null>(null);
  const [error, setError] = useState("");

  async function handleAddDomain() {
    if (!domain.trim()) return;
    setSaving(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch(`/api/websites/${page.id}/domain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: domain.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to add domain");
      } else {
        setResult({ message: data.message, dns: data.dns || [] });
      }
    } catch (e) {
      setError("Failed to add domain");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="wp-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="wp-modal wp-domain-modal">
        <div className="wp-modal-header">
          <div className="wp-modal-title">Custom Domain</div>
          <button className="wp-modal-close" onClick={onClose}>x</button>
        </div>

        <div style={{ padding: 24 }}>
          <div style={{ fontSize: 12, color: T.muted, marginBottom: 6 }}>Current URL</div>
          <div
            style={{
              fontFamily: "monospace",
              fontSize: 13,
              color: T.text,
              background: "rgba(255,255,255,0.04)",
              padding: "8px 12px",
              borderRadius: 6,
              marginBottom: 20,
            }}
          >
            thewolfpack.ai/s/{page.slug}
          </div>

          <div style={{ fontSize: 12, color: T.muted, marginBottom: 6 }}>
            Custom Domain
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="landing.yourbusiness.com"
              style={{
                flex: 1,
                padding: "10px 14px",
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${T.border}`,
                borderRadius: 8,
                color: T.text,
                fontSize: 13,
                outline: "none",
              }}
            />
            <button className="wp-btn" onClick={handleAddDomain} disabled={saving}>
              {saving ? "..." : "Add"}
            </button>
          </div>

          {error && (
            <div
              style={{
                padding: "10px 14px",
                background: "rgba(231,76,60,0.1)",
                border: `1px solid ${T.red}`,
                borderRadius: 8,
                color: T.red,
                fontSize: 12,
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}

          {result && (
            <div>
              <div
                style={{
                  padding: "10px 14px",
                  background: "rgba(46,204,113,0.1)",
                  border: `1px solid ${T.green}`,
                  borderRadius: 8,
                  color: T.green,
                  fontSize: 12,
                  marginBottom: 16,
                }}
              >
                {result.message}
              </div>

              {result.dns.length > 0 && (
                <div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: T.text,
                      marginBottom: 8,
                    }}
                  >
                    DNS Records to Configure:
                  </div>
                  <div
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: `1px solid ${T.border}`,
                      borderRadius: 8,
                      overflow: "hidden",
                    }}
                  >
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: 11,
                      }}
                    >
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                          <th style={{ padding: "8px 12px", textAlign: "left", color: T.muted }}>Type</th>
                          <th style={{ padding: "8px 12px", textAlign: "left", color: T.muted }}>Name</th>
                          <th style={{ padding: "8px 12px", textAlign: "left", color: T.muted }}>Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.dns.map((record, i) => (
                          <tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}>
                            <td style={{ padding: "8px 12px", color: T.orange, fontWeight: 700 }}>
                              {record.type}
                            </td>
                            <td style={{ padding: "8px 12px", color: T.text, fontFamily: "monospace" }}>
                              {record.name}
                            </td>
                            <td style={{ padding: "8px 12px", color: T.text, fontFamily: "monospace", wordBreak: "break-all" }}>
                              {record.value}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
