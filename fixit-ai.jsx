import { useState, useEffect, useRef, useCallback } from "react";

// ─── Utility ────────────────────────────────────────────────
const STORAGE_KEY = "fixit_history";
const USAGE_KEY   = "fixit_usage";
const FREE_LIMIT  = 3;

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}
function getUsage() {
  try {
    const raw = JSON.parse(localStorage.getItem(USAGE_KEY) || "{}");
    const today = getTodayKey();
    return raw[today] || 0;
  } catch { return 0; }
}
function incrementUsage() {
  try {
    const raw = JSON.parse(localStorage.getItem(USAGE_KEY) || "{}");
    const today = getTodayKey();
    raw[today] = (raw[today] || 0) + 1;
    localStorage.setItem(USAGE_KEY, JSON.stringify(raw));
  } catch {}
}
function getHistory() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
}
function saveToHistory(item) {
  try {
    const h = getHistory();
    h.unshift(item);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(h.slice(0, 20)));
  } catch {}
}

// ─── Anthropic API Call ──────────────────────────────────────
async function diagnoseItem({ text, imageBase64 }) {
  const content = [];
  if (imageBase64) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data: imageBase64 }
    });
  }
  content.push({
    type: "text",
    text: `You are FixIt AI, an expert repair technician and diagnostics specialist.

Analyze this ${imageBase64 ? "image and description" : "description"} of a broken/damaged item and provide a comprehensive repair guide.

${text ? `User description: "${text}"` : ""}

Respond ONLY with valid JSON (no markdown, no backticks) in this exact structure:
{
  "itemName": "Name of the broken item",
  "diagnosis": "Clear diagnosis of what's wrong (2-3 sentences)",
  "difficulty": "Easy|Medium|Hard",
  "estimatedCost": "$X - $Y",
  "estimatedTime": "X minutes/hours",
  "steps": [
    { "step": 1, "title": "Short title", "detail": "Detailed instruction", "tool": "Tool needed if any" }
  ],
  "tools": ["list", "of", "tools", "needed"],
  "materials": ["list", "of", "materials"],
  "safetyWarnings": ["Warning 1", "Warning 2"],
  "tips": ["Pro tip 1", "Pro tip 2"],
  "confidence": 85
}`
  });

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{ role: "user", content }]
    })
  });
  if (!resp.ok) throw new Error("API error " + resp.status);
  const data = await resp.json();
  const raw = data.content.map(b => b.text || "").join("");
  const clean = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

// ─── Icons ───────────────────────────────────────────────────
const Icon = ({ name, size = 20 }) => {
  const icons = {
    wrench: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>,
    upload: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>,
    camera: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>,
    sun: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
    moon: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
    copy: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
    share: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>,
    history: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/></svg>,
    alert: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><triangle points="10.29 3.86 1.82 18 2 18 22 18 22.18 18 13.71 3.86 10.29 3.86"/><polygon points="10.29 3.86 1.82 18 2 18 22 18 22.18 18 13.71 3.86 10.29 3.86"/><path d="M10.29 3.86L1.82 18h20.36zM12 9v4M12 17h.01"/></svg>,
    check: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
    x: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
    zap: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
    star: <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
    tool: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>,
    back: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>,
    crown: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 20h20M5 20l2-8 5 4 5-4 2 8"/><polyline points="5 12 3 7 8 9 12 4 16 9 21 7 19 12"/></svg>,
  };
  return icons[name] || null;
};

// ─── Difficulty Badge ────────────────────────────────────────
function DiffBadge({ level, dark }) {
  const map = { Easy: "#22c55e", Medium: "#f59e0b", Hard: "#ef4444" };
  const color = map[level] || "#6b7280";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 10px", borderRadius: 99, fontSize: 12, fontWeight: 700,
      background: color + "22", color, border: `1px solid ${color}44`,
      fontFamily: "'DM Mono', monospace"
    }}>
      {level === "Easy" ? "● EASY" : level === "Medium" ? "◆ MEDIUM" : "▲ HARD"}
    </span>
  );
}

// ─── Step Card ───────────────────────────────────────────────
function StepCard({ step, dark, idx }) {
  const [done, setDone] = useState(false);
  return (
    <div style={{
      display: "flex", gap: 14, padding: "16px 0",
      borderBottom: `1px solid ${dark ? "#ffffff10" : "#00000008"}`,
      opacity: done ? 0.5 : 1, transition: "opacity .2s",
    }}>
      <button
        onClick={() => setDone(d => !d)}
        style={{
          width: 28, height: 28, borderRadius: "50%", border: "none",
          background: done ? "#22c55e" : (dark ? "#ffffff18" : "#00000012"),
          color: done ? "#fff" : (dark ? "#ffffff60" : "#00000040"),
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", flexShrink: 0, marginTop: 2, transition: "all .15s"
        }}
      >
        {done ? <Icon name="check" size={14} /> : <span style={{ fontSize: 11, fontWeight: 700 }}>{idx + 1}</span>}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, fontFamily: "'Sora', sans-serif" }}>{step.title}</div>
        <div style={{ fontSize: 13, lineHeight: 1.6, color: dark ? "#ffffff90" : "#00000070" }}>{step.detail}</div>
        {step.tool && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 5, marginTop: 6,
            fontSize: 11, fontFamily: "'DM Mono', monospace",
            color: dark ? "#60a5fa" : "#2563eb",
            background: dark ? "#3b82f620" : "#2563eb12",
            padding: "2px 8px", borderRadius: 4
          }}>
            <Icon name="tool" size={10} /> {step.tool}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Result View ─────────────────────────────────────────────
function ResultView({ result, dark, onBack, imagePreview }) {
  const [copied, setCopied] = useState(false);

  const copySteps = useCallback(() => {
    const text = result.steps.map((s, i) => `${i + 1}. ${s.title}\n   ${s.detail}`).join("\n\n");
    navigator.clipboard.writeText(
      `FixIt AI — ${result.itemName}\n\n${result.diagnosis}\n\nSteps:\n${text}\n\nTools: ${result.tools?.join(", ")}\nEst. Cost: ${result.estimatedCost}\nDifficulty: ${result.difficulty}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [result]);

  const shareResult = useCallback(async () => {
    const text = `I just diagnosed my broken ${result.itemName} with FixIt AI! Difficulty: ${result.difficulty}, Est. Cost: ${result.estimatedCost}`;
    if (navigator.share) {
      try { await navigator.share({ title: "FixIt AI Diagnosis", text }); return; } catch {}
    }
    navigator.clipboard.writeText(text);
    alert("Share text copied to clipboard!");
  }, [result]);

  const card = { background: dark ? "#1e1e2e" : "#ffffff", borderRadius: 16, padding: "20px", marginBottom: 12, boxShadow: dark ? "0 2px 12px #00000040" : "0 2px 12px #00000010", border: `1px solid ${dark ? "#ffffff0a" : "#00000008"}` };

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 0 100px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button onClick={onBack} style={{ background: dark ? "#ffffff12" : "#00000008", border: "none", borderRadius: 10, width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: dark ? "#fff" : "#000" }}>
          <Icon name="back" size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: dark ? "#ffffff50" : "#00000040", textTransform: "uppercase", letterSpacing: 1 }}>DIAGNOSIS COMPLETE</div>
          <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "'Sora', sans-serif", lineHeight: 1.2 }}>{result.itemName}</div>
        </div>
        <div style={{
          width: 44, height: 44, borderRadius: 10, background: "#10b98122", display: "flex", alignItems: "center", justifyContent: "center",
          border: "1px solid #10b98144", color: "#10b981", fontSize: 11, fontFamily: "'DM Mono', monospace", fontWeight: 700, flexDirection: "column", lineHeight: 1.2, textAlign: "center"
        }}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>{result.confidence}%</div>
          <div style={{ fontSize: 8, opacity: 0.7 }}>CONF</div>
        </div>
      </div>

      {/* Image preview */}
      {imagePreview && (
        <div style={{ ...card, padding: 0, overflow: "hidden", marginBottom: 12 }}>
          <img src={imagePreview} alt="Submitted" style={{ width: "100%", height: 180, objectFit: "cover", display: "block" }} />
        </div>
      )}

      {/* Diagnosis */}
      <div style={card}>
        <div style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: dark ? "#ffffff50" : "#00000040", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>DIAGNOSIS</div>
        <p style={{ fontSize: 14, lineHeight: 1.65, margin: 0, color: dark ? "#ffffffcc" : "#000000cc" }}>{result.diagnosis}</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
          <DiffBadge level={result.difficulty} dark={dark} />
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 99, fontSize: 12, fontWeight: 600, background: dark ? "#8b5cf620" : "#7c3aed12", color: dark ? "#a78bfa" : "#7c3aed", border: `1px solid ${dark ? "#8b5cf640" : "#7c3aed20"}`, fontFamily: "'DM Mono', monospace" }}>
            💰 {result.estimatedCost}
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 99, fontSize: 12, fontWeight: 600, background: dark ? "#0ea5e920" : "#0284c712", color: dark ? "#38bdf8" : "#0284c7", border: `1px solid ${dark ? "#0ea5e940" : "#0284c720"}`, fontFamily: "'DM Mono', monospace" }}>
            ⏱ {result.estimatedTime}
          </span>
        </div>
      </div>

      {/* Safety Warnings */}
      {result.safetyWarnings?.length > 0 && (
        <div style={{ ...card, background: dark ? "#7f1d1d22" : "#fef2f2", border: `1px solid ${dark ? "#ef444430" : "#fecaca"}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <span style={{ fontSize: 16 }}>⚠️</span>
            <div style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: dark ? "#fca5a5" : "#dc2626", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>SAFETY WARNINGS</div>
          </div>
          {result.safetyWarnings.map((w, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: i < result.safetyWarnings.length - 1 ? 6 : 0 }}>
              <span style={{ color: "#ef4444", flexShrink: 0, marginTop: 1 }}>▸</span>
              <span style={{ fontSize: 13, color: dark ? "#fca5a5cc" : "#991b1b", lineHeight: 1.5 }}>{w}</span>
            </div>
          ))}
        </div>
      )}

      {/* Steps */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <div style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: dark ? "#ffffff50" : "#00000040", textTransform: "uppercase", letterSpacing: 1 }}>REPAIR STEPS</div>
          <span style={{ fontSize: 11, color: dark ? "#ffffff40" : "#00000030", fontFamily: "'DM Mono', monospace" }}>{result.steps.length} steps</span>
        </div>
        {result.steps.map((s, i) => <StepCard key={i} step={s} dark={dark} idx={i} />)}
      </div>

      {/* Tools & Materials */}
      {(result.tools?.length > 0 || result.materials?.length > 0) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          {result.tools?.length > 0 && (
            <div style={{ ...card, marginBottom: 0 }}>
              <div style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: dark ? "#ffffff40" : "#00000030", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>TOOLS</div>
              {result.tools.map((t, i) => (
                <div key={i} style={{ fontSize: 12, color: dark ? "#ffffff80" : "#00000070", marginBottom: 4, display: "flex", gap: 6, alignItems: "flex-start" }}>
                  <span style={{ color: "#3b82f6", flexShrink: 0 }}>·</span> {t}
                </div>
              ))}
            </div>
          )}
          {result.materials?.length > 0 && (
            <div style={{ ...card, marginBottom: 0 }}>
              <div style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: dark ? "#ffffff40" : "#00000030", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>MATERIALS</div>
              {result.materials.map((m, i) => (
                <div key={i} style={{ fontSize: 12, color: dark ? "#ffffff80" : "#00000070", marginBottom: 4, display: "flex", gap: 6, alignItems: "flex-start" }}>
                  <span style={{ color: "#10b981", flexShrink: 0 }}>·</span> {m}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tips */}
      {result.tips?.length > 0 && (
        <div style={{ ...card, background: dark ? "#1d4ed820" : "#eff6ff", border: `1px solid ${dark ? "#3b82f630" : "#bfdbfe"}` }}>
          <div style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: dark ? "#60a5fa" : "#2563eb", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>💡 PRO TIPS</div>
          {result.tips.map((t, i) => (
            <div key={i} style={{ fontSize: 13, color: dark ? "#93c5fdcc" : "#1d4ed8cc", marginBottom: i < result.tips.length - 1 ? 6 : 0, lineHeight: 1.5 }}>
              {i + 1}. {t}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
        <button onClick={copySteps} style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          padding: "13px 0", borderRadius: 12, border: `1.5px solid ${dark ? "#ffffff20" : "#00000015"}`,
          background: dark ? "#ffffff0a" : "#f9fafb", cursor: "pointer",
          fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: 13,
          color: dark ? "#ffffffcc" : "#000000cc", transition: "all .15s"
        }}>
          {copied ? <><Icon name="check" size={16} /> Copied!</> : <><Icon name="copy" size={16} /> Copy Steps</>}
        </button>
        <button onClick={shareResult} style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          padding: "13px 0", borderRadius: 12, border: "none",
          background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
          cursor: "pointer", fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: 13, color: "#fff",
          transition: "all .15s"
        }}>
          <Icon name="share" size={16} /> Share
        </button>
      </div>
    </div>
  );
}

// ─── History View ─────────────────────────────────────────────
function HistoryView({ dark, onBack, onSelect }) {
  const history = getHistory();
  const card = { background: dark ? "#1e1e2e" : "#ffffff", borderRadius: 14, padding: "14px 16px", marginBottom: 10, boxShadow: dark ? "0 2px 8px #00000040" : "0 2px 8px #00000008", border: `1px solid ${dark ? "#ffffff0a" : "#00000008"}`, cursor: "pointer" };

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 0 80px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button onClick={onBack} style={{ background: dark ? "#ffffff12" : "#00000008", border: "none", borderRadius: 10, width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: dark ? "#fff" : "#000" }}>
          <Icon name="back" size={18} />
        </button>
        <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Sora', sans-serif" }}>Repair History</div>
      </div>
      {history.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: dark ? "#ffffff40" : "#00000030" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔧</div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13 }}>No repairs yet</div>
        </div>
      ) : history.map((h, i) => (
        <div key={i} style={card} onClick={() => onSelect(h)}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15, fontFamily: "'Sora', sans-serif", marginBottom: 3 }}>{h.result.itemName}</div>
              <div style={{ fontSize: 12, color: dark ? "#ffffff50" : "#00000045", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{h.result.diagnosis}</div>
            </div>
            <DiffBadge level={h.result.difficulty} dark={dark} />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
            <span style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: dark ? "#ffffff30" : "#00000030" }}>{new Date(h.timestamp).toLocaleDateString()}</span>
            <span style={{ fontSize: 11, color: dark ? "#ffffff30" : "#00000030" }}>·</span>
            <span style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: dark ? "#ffffff40" : "#00000040" }}>{h.result.estimatedCost}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Plans Modal ─────────────────────────────────────────────
function PlansModal({ dark, onClose }) {
  const overlay = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" };
  const sheet = { background: dark ? "#1a1a2e" : "#fff", borderRadius: "24px 24px 0 0", padding: "28px 20px 40px", width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto" };
  const planCard = (color, emoji, title, price, features, link, label) => (
    <div style={{ background: dark ? "#ffffff08" : "#f9fafb", borderRadius: 16, padding: 18, marginBottom: 12, border: `1.5px solid ${color}30` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 18, marginBottom: 2 }}>{emoji}</div>
          <div style={{ fontWeight: 800, fontSize: 17, fontFamily: "'Sora', sans-serif" }}>{title}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: 20, color }}>{price}</div>
          <div style={{ fontSize: 11, color: dark ? "#ffffff40" : "#00000040" }}>/month</div>
        </div>
      </div>
      {features.map((f, i) => (
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, fontSize: 13 }}>
          <span style={{ color: "#22c55e", flexShrink: 0, marginTop: 1 }}>✓</span>
          <span style={{ color: dark ? "#ffffffcc" : "#000000cc" }}>{f}</span>
        </div>
      ))}
      <button
        onClick={() => window.open(link, "_blank")}
        style={{
          width: "100%", marginTop: 14, padding: "13px", borderRadius: 12, border: "none",
          background: `linear-gradient(135deg, ${color}, ${color}cc)`,
          color: "#fff", fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 14,
          cursor: "pointer"
        }}
      >
        {label}
      </button>
    </div>
  );

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={sheet}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontWeight: 800, fontSize: 22, fontFamily: "'Sora', sans-serif" }}>Upgrade Plan</div>
          <button onClick={onClose} style={{ background: dark ? "#ffffff12" : "#00000008", border: "none", borderRadius: 8, width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: dark ? "#fff" : "#000" }}>
            <Icon name="x" size={16} />
          </button>
        </div>

        {/* Free */}
        <div style={{ background: dark ? "#ffffff06" : "#f3f4f6", borderRadius: 14, padding: "14px 16px", marginBottom: 12, border: `1px solid ${dark ? "#ffffff10" : "#00000010"}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontWeight: 700, fontFamily: "'Sora', sans-serif" }}>🔓 Free</div>
            <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: 16 }}>$0</span>
          </div>
          {["3 fixes/day", "Basic repair advice", "Image or text input"].map((f, i) => (
            <div key={i} style={{ display: "flex", gap: 8, fontSize: 12, color: dark ? "#ffffff60" : "#00000060", marginBottom: 3 }}>
              <span>·</span> {f}
            </div>
          ))}
        </div>

        {planCard(
          "#3b82f6", "⚡", "Pro", "$4.99",
          ["Unlimited fixes", "Advanced repair instructions", "Cost estimation", "Safety warnings", "Save history", "Faster responses"],
          "https://veloxora-apps-and-games.lemonsqueezy.com/checkout/buy/a0e6a5f5-0659-4a87-b129-1b37e011290b",
          "Upgrade to Pro"
        )}
        {planCard(
          "#f59e0b", "👑", "Elite", "$9.99",
          ["Everything in Pro", "Advanced diagnostics", "Deeper AI reasoning", "Expert-level repair guides", "Priority features", "Complex failure analysis"],
          "https://veloxora-apps-and-games.lemonsqueezy.com/checkout/buy/62b7852f-7fa8-42e4-a287-35a856242bc9",
          "Upgrade to Elite"
        )}
      </div>
    </div>
  );
}

// ─── Loading Spinner ──────────────────────────────────────────
function LoadingView({ dark }) {
  const steps = ["Analyzing image...", "Identifying fault...", "Generating repair plan...", "Calculating costs..."];
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep(s => (s + 1) % steps.length), 1400);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 20 }}>
      <div style={{
        width: 72, height: 72, borderRadius: 20,
        background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
        display: "flex", alignItems: "center", justifyContent: "center",
        animation: "pulse 1.5s ease-in-out infinite",
        fontSize: 32
      }}>🔧</div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontWeight: 800, fontSize: 18, fontFamily: "'Sora', sans-serif", marginBottom: 8 }}>Diagnosing...</div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: dark ? "#ffffff50" : "#00000050", minHeight: 20 }}>{steps[step]}</div>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 8, height: 8, borderRadius: "50%",
            background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
            animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`
          }} />
        ))}
      </div>
    </div>
  );
}

// ─── Main App ────────────────────────────────────────────────
export default function FixItAI() {
  const [dark, setDark] = useState(true);
  const [view, setView] = useState("home"); // home | loading | result | history
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [showPlans, setShowPlans] = useState(false);
  const [historyResult, setHistoryResult] = useState(null);
  const fileRef = useRef();
  const usage = getUsage();
  const isLimited = usage >= FREE_LIMIT;

  const bg = dark ? "#0f0f1a" : "#f0f4ff";
  const fg = dark ? "#fff" : "#0f0f1a";
  const cardBg = dark ? "#1e1e2e" : "#fff";
  const muted = dark ? "#ffffff50" : "#00000050";

  const handleImageChange = (file) => {
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target.result);
      const base64 = e.target.result.split(",")[1];
      setImageBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) handleImageChange(file);
  };

  const handleSubmit = async () => {
    if (!text.trim() && !imageBase64) {
      setError("Please describe the issue or upload an image.");
      return;
    }
    if (isLimited) { setShowPlans(true); return; }
    setError(null);
    setView("loading");
    try {
      const res = await diagnoseItem({ text: text.trim(), imageBase64 });
      incrementUsage();
      const entry = { result: res, text: text.trim(), timestamp: Date.now() };
      saveToHistory(entry);
      setResult(res);
      setView("result");
    } catch (e) {
      console.error(e);
      setError("Diagnosis failed. Please try again.");
      setView("home");
    }
  };

  const exampleItems = [
    { emoji: "🚿", label: "Leaky faucet" },
    { emoji: "📱", label: "Cracked screen" },
    { emoji: "🪑", label: "Broken chair leg" },
    { emoji: "🚗", label: "Car won't start" },
    { emoji: "💡", label: "Flickering light" },
    { emoji: "🚪", label: "Stuck door" },
  ];

  if (view === "loading") return (
    <div style={{ minHeight: "100vh", background: bg, color: fg, padding: 20, fontFamily: "'Sora', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Mono:wght@400;500&display=swap'); @keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}} @keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}`}</style>
      <LoadingView dark={dark} />
    </div>
  );

  if (view === "result" && result) return (
    <div style={{ minHeight: "100vh", background: bg, color: fg, padding: "20px 16px", fontFamily: "'Sora', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Mono:wght@400;500&display=swap');`}</style>
      <ResultView result={result} dark={dark} imagePreview={imagePreview} onBack={() => setView("home")} />
    </div>
  );

  if (view === "history") return (
    <div style={{ minHeight: "100vh", background: bg, color: fg, padding: "20px 16px", fontFamily: "'Sora', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Mono:wght@400;500&display=swap');`}</style>
      <HistoryView dark={dark} onBack={() => setView("home")} onSelect={(h) => { setResult(h.result); setImagePreview(null); setView("result"); }} />
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: bg, color: fg, fontFamily: "'Sora', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        textarea { font-family: 'Sora', sans-serif; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-thumb { background: #3b82f640; border-radius: 2px; }
        button { -webkit-tap-highlight-color: transparent; }
      `}</style>

      {showPlans && <PlansModal dark={dark} onClose={() => setShowPlans(false)} />}

      {/* Header */}
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "16px 16px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🔧</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 17, fontFamily: "'Sora', sans-serif", lineHeight: 1 }}>FixIt AI</div>
              <div style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: muted, lineHeight: 1.3 }}>REPAIR DIAGNOSTICS</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setView("history")} style={{ background: dark ? "#ffffff10" : "#00000008", border: "none", borderRadius: 10, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: fg }}>
              <Icon name="history" size={17} />
            </button>
            <button onClick={() => setDark(d => !d)} style={{ background: dark ? "#ffffff10" : "#00000008", border: "none", borderRadius: 10, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: fg }}>
              <Icon name={dark ? "sun" : "moon"} size={17} />
            </button>
          </div>
        </div>

        {/* Usage bar */}
        <div style={{ background: cardBg, borderRadius: 14, padding: "12px 16px", marginBottom: 20, border: `1px solid ${dark ? "#ffffff0a" : "#00000008"}`, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontFamily: "'DM Mono', monospace", color: muted }}>FREE PLAN · {Math.max(0, FREE_LIMIT - usage)}/{FREE_LIMIT} remaining today</span>
            </div>
            <div style={{ height: 5, background: dark ? "#ffffff12" : "#00000010", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${(usage / FREE_LIMIT) * 100}%`, background: isLimited ? "#ef4444" : "linear-gradient(90deg, #3b82f6, #8b5cf6)", borderRadius: 99, transition: "width .3s" }} />
            </div>
          </div>
          <button onClick={() => setShowPlans(true)} style={{ background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", border: "none", borderRadius: 8, padding: "6px 12px", color: "#fff", fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}>
            ⚡ Upgrade
          </button>
        </div>

        {/* Headline */}
        <div style={{ marginBottom: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: "clamp(24px, 7vw, 32px)", fontWeight: 800, fontFamily: "'Sora', sans-serif", lineHeight: 1.2, margin: "0 0 8px" }}>
            What's broken?<br />
            <span style={{ background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              I'll fix it.
            </span>
          </h1>
          <p style={{ fontSize: 14, color: muted, margin: 0, lineHeight: 1.5 }}>Upload a photo or describe the problem — get step-by-step repair instructions instantly.</p>
        </div>

        {/* Image Upload */}
        <div
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => fileRef.current.click()}
          style={{
            background: cardBg, borderRadius: 16,
            border: `2px dashed ${imagePreview ? "#3b82f6" : (dark ? "#ffffff18" : "#00000015")}`,
            padding: imagePreview ? 0 : "28px 20px",
            marginBottom: 14, cursor: "pointer", overflow: "hidden",
            transition: "all .2s"
          }}
        >
          {imagePreview ? (
            <div style={{ position: "relative" }}>
              <img src={imagePreview} alt="Preview" style={{ width: "100%", height: 200, objectFit: "cover", display: "block" }} />
              <button onClick={e => { e.stopPropagation(); setImageFile(null); setImagePreview(null); setImageBase64(null); }} style={{
                position: "absolute", top: 10, right: 10, background: "rgba(0,0,0,0.7)", border: "none", borderRadius: "50%",
                width: 30, height: 30, cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                <Icon name="x" size={14} />
              </button>
              <div style={{ padding: "8px 14px 12px", background: dark ? "#1e1e2e" : "#fff" }}>
                <div style={{ fontSize: 12, fontFamily: "'DM Mono', monospace", color: muted }}>{imageFile?.name || "Image uploaded"}</div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "center" }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: dark ? "#3b82f620" : "#3b82f610", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", color: "#3b82f6" }}>
                <Icon name="camera" size={24} />
              </div>
              <div style={{ fontWeight: 700, fontSize: 15, fontFamily: "'Sora', sans-serif", marginBottom: 4 }}>Drop photo here</div>
              <div style={{ fontSize: 13, color: muted }}>or tap to choose from gallery</div>
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleImageChange(e.target.files[0])} />

        {/* Text Input */}
        <div style={{ background: cardBg, borderRadius: 16, marginBottom: 14, border: `1px solid ${dark ? "#ffffff0a" : "#00000008"}`, overflow: "hidden" }}>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="e.g. 'My kitchen faucet is dripping constantly and the handle feels loose...'"
            rows={4}
            style={{
              width: "100%", background: "transparent", border: "none", outline: "none",
              padding: "16px", fontSize: 14, lineHeight: 1.6, color: fg, resize: "none",
              fontFamily: "'Sora', sans-serif"
            }}
          />
          {text && (
            <div style={{ padding: "0 16px 10px", display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => setText("")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: muted, fontFamily: "'DM Mono', monospace" }}>CLEAR</button>
            </div>
          )}
        </div>

        {/* Quick examples */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>QUICK EXAMPLES</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {exampleItems.map((item, i) => (
              <button key={i} onClick={() => setText(item.label)} style={{
                background: dark ? "#ffffff08" : "#f3f4f6", border: `1px solid ${dark ? "#ffffff10" : "#00000010"}`,
                borderRadius: 10, padding: "8px 6px", cursor: "pointer", color: fg,
                fontFamily: "'Sora', sans-serif", fontSize: 12, fontWeight: 600, textAlign: "center"
              }}>
                <div style={{ fontSize: 18, marginBottom: 2 }}>{item.emoji}</div>
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: dark ? "#7f1d1d20" : "#fef2f2", border: `1px solid ${dark ? "#ef444430" : "#fecaca"}`, borderRadius: 12, padding: "12px 16px", marginBottom: 14, fontSize: 13, color: dark ? "#fca5a5" : "#dc2626" }}>
            ⚠️ {error}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!text.trim() && !imageBase64}
          style={{
            width: "100%", padding: "16px", borderRadius: 14, border: "none",
            background: (!text.trim() && !imageBase64) ? (dark ? "#ffffff10" : "#00000010") : "linear-gradient(135deg, #3b82f6, #8b5cf6)",
            color: (!text.trim() && !imageBase64) ? muted : "#fff",
            fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: 16,
            cursor: (!text.trim() && !imageBase64) ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            transition: "all .15s", boxShadow: (!text.trim() && !imageBase64) ? "none" : "0 4px 20px #3b82f640",
            marginBottom: 16
          }}
        >
          <Icon name="wrench" size={20} />
          {isLimited ? "Upgrade to Diagnose More" : "Diagnose & Fix It"}
        </button>

        {/* Pro/Elite CTA */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 32 }}>
          <button onClick={() => window.open("https://veloxora-apps-and-games.lemonsqueezy.com/checkout/buy/a0e6a5f5-0659-4a87-b129-1b37e011290b", "_blank")} style={{
            padding: "12px 8px", borderRadius: 12, border: "1.5px solid #3b82f650", background: dark ? "#3b82f610" : "#eff6ff",
            color: dark ? "#60a5fa" : "#2563eb", fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 13, cursor: "pointer"
          }}>
            ⚡ Upgrade to Pro<br />
            <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.7 }}>$4.99/month</span>
          </button>
          <button onClick={() => window.open("https://veloxora-apps-and-games.lemonsqueezy.com/checkout/buy/62b7852f-7fa8-42e4-a287-35a856242bc9", "_blank")} style={{
            padding: "12px 8px", borderRadius: 12, border: "1.5px solid #f59e0b50", background: dark ? "#f59e0b10" : "#fffbeb",
            color: dark ? "#fbbf24" : "#d97706", fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 13, cursor: "pointer"
          }}>
            👑 Upgrade to Elite<br />
            <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.7 }}>$9.99/month</span>
          </button>
        </div>
      </div>
    </div>
  );
}
