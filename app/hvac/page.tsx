import NicheLandingPage from "../components/NicheLandingPage";
import type { NicheConfig } from "../components/NicheLandingPage";

const config: NicheConfig = {
  brand: { name: "COMFORT ZONE", highlight: "HVAC" },
  accent: "#2BA5A5",
  accentDark: "#1e8a8a",
  hero: {
    image: "/hvac-hero.png",
    tagline: "Warren, Michigan — Since 2012",
    titleLine1: "YOUR COMFORT.",
    titleLine2: "OUR PRIORITY.",
    subtitle: "AC repair, furnace installation, and preventive maintenance. NATE-certified technicians, 24/7 emergency service, honest pricing.",
    cta: "Schedule Service",
  },
  stats: [
    { value: "2,400+", label: "Homes Serviced" },
    { value: "12", label: "Years Experience" },
    { value: "4.9", label: "Google Rating" },
    { value: "NATE", label: "Certified" },
  ],
  services: [
    { title: "AC Repair & Install", desc: "From emergency breakdowns on the hottest day to full system upgrades, we keep your home cool and comfortable all summer.", image: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800&q=80" },
    { title: "Furnace Repair & Install", desc: "High-efficiency furnace installation, repair, and maintenance. We service all major brands and ensure your family stays warm through Michigan winters.", image: "https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=800&q=80" },
    { title: "Maintenance Plans", desc: "Preventive maintenance that catches problems before they become emergencies. Twice-yearly tune-ups keep your system running at peak efficiency.", image: "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=800&q=80" },
  ],
  reasons: [
    { num: "01", title: "NATE Certified", desc: "Our technicians hold NATE certifications, the gold standard in HVAC training and expertise." },
    { num: "02", title: "24/7 Emergency", desc: "Furnace quit at 2am? AC died on the hottest day? We answer the phone and show up fast." },
    { num: "03", title: "Financing Available", desc: "Don't let cost stop you from staying comfortable. Flexible financing on new systems." },
    { num: "04", title: "Guaranteed Work", desc: "We stand behind every job. If you're not happy, we make it right, no questions asked." },
  ],
  testimonials: [
    { name: "Jennifer M.", location: "Troy, MI", text: "Our AC went out in the middle of July and they had a tech here within two hours. Professional, fair pricing, and our house was cool again by dinner." },
    { name: "David & Lisa K.", location: "Rochester Hills, MI", text: "We've used Comfort Zone for our furnace maintenance for three years now. Always on time, always thorough. They caught a cracked heat exchanger last fall." },
    { name: "Robert T.", location: "Sterling Heights, MI", text: "Got quotes from four companies for a new HVAC system. Comfort Zone was the most honest and competitively priced. Install crew was clean and fast." },
  ],
  cta: { title: "Don't Sweat It. Don't Freeze.", subtitle: "Schedule your service today. We respond to every inquiry within 15 minutes.", phone: "(248) 555-0193" },
  footer: { desc: "Trusted residential HVAC services in Warren, Michigan and surrounding communities since 2012.", address: "8240 Van Dyke Ave\nWarren, MI 48089", phone: "(248) 555-0193", license: "Licensed & Insured — State of Michigan" },
  chatTrade: "hvac",
};

export default function HvacPage() {
  return <NicheLandingPage config={config} />;
}
