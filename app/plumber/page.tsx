import NicheLandingPage from "../components/NicheLandingPage";
import type { NicheConfig } from "../components/NicheLandingPage";

const config: NicheConfig = {
  brand: { name: "METRO", highlight: "PLUMBING" },
  accent: "#2B7CD4",
  accentDark: "#2468b0",
  hero: {
    image: "/plumber-hero.png",
    tagline: "Warren, Michigan — Since 2009",
    titleLine1: "YOUR PIPES.",
    titleLine2: "OUR CRAFT.",
    subtitle: "Emergency repairs, bathroom remodels, water heater installs. Licensed Michigan plumber, 24/7 service, upfront pricing.",
    cta: "Schedule Service",
  },
  stats: [
    { value: "3,200+", label: "Jobs Completed" },
    { value: "15", label: "Years Experience" },
    { value: "4.9", label: "Google Rating" },
    { value: "Licensed", label: "& Insured" },
  ],
  services: [
    { title: "Emergency Repairs", desc: "Burst pipes, flooding, and urgent plumbing crises handled around the clock. We arrive equipped and ready to stop the damage before it spreads. No overtime charges, no surprises.", image: "https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?w=800&q=80" },
    { title: "Bathroom Remodels", desc: "Complete bathroom plumbing rough-in and finish work. From custom showers and freestanding tubs to vanity installations, we handle every pipe and fixture so your renovation goes right the first time.", image: "https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=800&q=80" },
    { title: "Water Heater Install", desc: "Tank and tankless water heater installation, repair, and replacement. We service all major brands and help you choose the right system for your home's demand and budget.", image: "https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=800&q=80" },
  ],
  reasons: [
    { num: "01", title: "Licensed & Insured", desc: "Fully licensed Michigan plumber with comprehensive liability and workers comp coverage on every job." },
    { num: "02", title: "24/7 Emergency", desc: "Plumbing emergencies don't wait. Neither do we. Call any time, day or night, and we'll be there." },
    { num: "03", title: "Free Estimates", desc: "Upfront pricing with no hidden fees. We give you an honest quote before any work begins." },
    { num: "04", title: "Guaranteed Work", desc: "If you're not happy with our work, we come back and make it right. That's our promise to every customer." },
  ],
  testimonials: [
    { name: "Chris & Amy L.", location: "Warren, MI", text: "Had a pipe burst in our basement at midnight. Metro was here in 45 minutes and had it fixed before we went back to bed. Can't thank them enough." },
    { name: "Stephanie R.", location: "Sterling Heights, MI", text: "They did our entire master bath remodel. Every fixture, every pipe. On time, on budget, and the quality is outstanding." },
    { name: "Mark D.", location: "Troy, MI", text: "Honest, fair, and they actually show up when they say they will. That alone puts them ahead of every other plumber I've called." },
  ],
  cta: { title: "Don't Let It Drip.", subtitle: "Schedule your service today. We respond to every inquiry within 15 minutes.", phone: "(586) 555-0142" },
  footer: { desc: "Trusted residential and commercial plumbing services in Warren, Michigan and surrounding communities since 2009.", address: "12600 Twelve Mile Rd\nWarren, MI 48093", phone: "(586) 555-0142", license: "Licensed & Insured — State of Michigan" },
  chatTrade: "plumber",
};

export default function PlumberPage() {
  return <NicheLandingPage config={config} />;
}
