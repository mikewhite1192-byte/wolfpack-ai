"use client";

const T = {
  orange: "#E86A2A",
  text: "#e8eaf0",
  muted: "#b0b4c8",
  surface: "#111827",
  border: "rgba(255,255,255,0.07)",
};

const EXAMPLE_AUTOMATIONS = [
  { trigger: "New Lead", actions: ["Send SMS immediately", "Send email after 5 min"], active: false },
  { trigger: "Contacted", actions: ["Send follow-up SMS after 24 hrs"], active: false },
  { trigger: "Qualified", actions: ["Send proposal email immediately"], active: false },
];

export default function AutomationsPage() {
  return (
    <div>
      <style>{`
        .auto-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
        .auto-title { font-family: 'Bebas Neue', sans-serif; font-size: 28px; color: ${T.text}; letter-spacing: 1px; }
        .auto-btn { padding: 10px 20px; background: ${T.orange}; color: #fff; font-size: 13px; font-weight: 700; border: none; border-radius: 8px; cursor: pointer; }
        .auto-list { display: flex; flex-direction: column; gap: 12px; }
        .auto-card { background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 12px; padding: 20px 24px; display: flex; align-items: flex-start; gap: 16px; }
        .auto-card-body { flex: 1; }
        .auto-trigger-label { font-size: 10px; font-weight: 700; color: ${T.orange}; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 6px; }
        .auto-trigger-name { font-size: 15px; font-weight: 600; color: ${T.text}; margin-bottom: 10px; }
        .auto-actions { display: flex; flex-direction: column; gap: 6px; }
        .auto-action { display: flex; align-items: center; gap: 8px; font-size: 13px; color: ${T.muted}; }
        .auto-action-dot { width: 6px; height: 6px; border-radius: 50%; background: ${T.orange}; flex-shrink: 0; }
        .auto-toggle { position: relative; width: 40px; height: 22px; flex-shrink: 0; }
        .auto-toggle input { opacity: 0; width: 0; height: 0; }
        .auto-toggle-slider { position: absolute; inset: 0; background: rgba(255,255,255,0.1); border-radius: 22px; cursor: pointer; transition: 0.2s; }
        .auto-toggle input:checked + .auto-toggle-slider { background: ${T.orange}; }
        .auto-toggle-slider::before { content: ''; position: absolute; width: 16px; height: 16px; background: #fff; border-radius: 50%; top: 3px; left: 3px; transition: 0.2s; }
        .auto-toggle input:checked + .auto-toggle-slider::before { transform: translateX(18px); }
      `}</style>

      <div className="auto-header">
        <div className="auto-title">AUTOMATIONS</div>
        <button className="auto-btn">+ New Automation</button>
      </div>

      <div className="auto-list">
        {EXAMPLE_AUTOMATIONS.map((a, i) => (
          <div key={i} className="auto-card">
            <div className="auto-card-body">
              <div className="auto-trigger-label">When stage becomes</div>
              <div className="auto-trigger-name">{a.trigger}</div>
              <div className="auto-actions">
                {a.actions.map(action => (
                  <div key={action} className="auto-action">
                    <div className="auto-action-dot" />
                    {action}
                  </div>
                ))}
              </div>
            </div>
            <label className="auto-toggle">
              <input type="checkbox" defaultChecked={a.active} />
              <span className="auto-toggle-slider" />
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}
