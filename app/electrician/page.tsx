import NicheLandingPage from "../components/NicheLandingPage";
import type { NicheConfig } from "../components/NicheLandingPage";

const config: NicheConfig = {
  brand: { name: "VOLT", highlight: "ELECTRIC" },
  accent: "#D4A02B",
  accentDark: "#b8891f",
  hero: {
    image: "/electrician-hero.png",
    tagline: "Sterling Heights, Michigan — Since 2010",
    titleLine1: "YOUR WIRING.",
    titleLine2: "OUR EXPERTISE.",
    subtitle: "Panel upgrades, EV charger installs, complete rewiring. Master-licensed electricians, same-day service, code compliant.",
    cta: "Schedule Service",
  },
  stats: [
    { value: "1,800+", label: "Jobs Completed" },
    { value: "14", label: "Years Experience" },
    { value: "4.9", label: "Google Rating" },
    { value: "Master", label: "Licensed" },
  ],
  services: [
    { title: "Panel Upgrades", desc: "Upgrade your electrical panel to handle modern power demands safely. 100A to 200A+ conversions for homes adding EV chargers, hot tubs, or workshop equipment.", image: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800&q=80" },
    { title: "EV Charger Install", desc: "Level 2 home charging stations for Tesla, Ford, Chevy, and all major EV brands. Same-week installation with full permit and inspection handling.", image: "/electrician-ev.png" },
    { title: "Lighting & Wiring", desc: "Recessed lighting, under-cabinet LEDs, landscape lighting, and complete home rewiring. We design and install systems that transform your space.", image: "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=800&q=80" },
  ],
  reasons: [
    { num: "01", title: "Master Licensed", desc: "State-licensed master electricians on every job. No subcontractors, no shortcuts." },
    { num: "02", title: "Upfront Pricing", desc: "Flat-rate quotes before we start. No surprise charges, no hourly billing games." },
    { num: "03", title: "Same-Day Service", desc: "Emergency calls answered 24/7. Most non-emergency jobs scheduled within 48 hours." },
    { num: "04", title: "Code Compliant", desc: "Every job meets or exceeds NEC standards. We pull permits and schedule inspections." },
  ],
  testimonials: [
    { name: "Kevin & Sarah M.", location: "Sterling Heights, MI", text: "Had our panel upgraded from 100A to 200A for a Tesla charger. Volt was the only company that could do it within the week. Clean work, passed inspection first try." },
    { name: "Patricia L.", location: "Troy, MI", text: "They rewired our entire 1960s home. Not a single wall patch out of place. Professional from start to finish." },
    { name: "James R.", location: "Rochester Hills, MI", text: "Called for an emergency at 11pm — outlet was sparking. They were here in 30 minutes and found a serious issue behind the wall. Saved us from a fire." },
  ],
  cta: { title: "Don't Risk It. Call a Pro.", subtitle: "Schedule your service today. We respond to every inquiry within 15 minutes.", phone: "(586) 555-0319" },
  footer: { desc: "Trusted residential and commercial electrical services in Sterling Heights, Michigan and surrounding communities since 2010.", address: "9400 Ryan Rd\nSterling Heights, MI 48314", phone: "(586) 555-0319", license: "Master Licensed — State of Michigan" },
  chatTrade: "electrician",
};

export default function ElectricianPage() {
  return <NicheLandingPage config={config} />;
}
