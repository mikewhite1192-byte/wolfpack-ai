"use client";

import { Plus } from "lucide-react";

const EXAMPLE_AUTOMATIONS = [
  { trigger: "New Lead", actions: ["Send SMS immediately", "Send email after 5 min"], active: false },
  { trigger: "Contacted", actions: ["Send follow-up SMS after 24 hrs"], active: false },
  { trigger: "Qualified", actions: ["Send proposal email immediately"], active: false },
];

export default function AutomationsPage() {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="font-display text-[28px] text-[#e8eaf0] tracking-wide">AUTOMATIONS</div>
        <button className="flex items-center gap-1.5 px-5 py-2.5 bg-[#E86A2A] text-white text-sm font-bold border-none rounded-lg cursor-pointer hover:bg-[#ff7b3a] transition-colors">
          <Plus className="w-3.5 h-3.5" /> New Automation
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {EXAMPLE_AUTOMATIONS.map((a, i) => (
          <div key={i} className="bg-[#111] border border-white/[0.07] rounded-xl px-6 py-5 flex items-start gap-4 hover:border-white/[0.12] transition-colors">
            <div className="flex-1">
              <div className="text-[10px] font-bold text-[#E86A2A] tracking-widest uppercase mb-1.5">When stage becomes</div>
              <div className="text-[15px] font-semibold text-[#e8eaf0] mb-2.5">{a.trigger}</div>
              <div className="flex flex-col gap-1.5">
                {a.actions.map(action => (
                  <div key={action} className="flex items-center gap-2 text-sm text-[#b0b4c8]">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#E86A2A] flex-shrink-0" />
                    {action}
                  </div>
                ))}
              </div>
            </div>
            <label className="relative w-10 h-[22px] flex-shrink-0 cursor-pointer">
              <input type="checkbox" defaultChecked={a.active} className="peer sr-only" />
              <div className="absolute inset-0 bg-white/10 rounded-full transition-colors peer-checked:bg-[#E86A2A]" />
              <div className="absolute w-4 h-4 bg-white rounded-full top-[3px] left-[3px] transition-transform peer-checked:translate-x-[18px]" />
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}
