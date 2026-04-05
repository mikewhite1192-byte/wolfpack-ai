import NicheLandingPage from "../components/NicheLandingPage";
import type { NicheConfig } from "../components/NicheLandingPage";

const config: NicheConfig = {
  brand: { name: "SUMMIT", highlight: "ROOFING" },
  accent: "#C4412B",
  accentDark: "#a83723",
  hero: {
    image: "/roofing-hero.png",
    tagline: "Sterling Heights, Michigan — Since 2009",
    titleLine1: "YOUR ROOF.",
    titleLine2: "OUR REPUTATION.",
    subtitle: "Storm damage repair. Full replacements. Free inspections. Fast response, insurance claim help, guaranteed work.",
    cta: "Schedule Inspection",
  },
  stats: [
    { value: "850+", label: "Roofs Completed" },
    { value: "17", label: "Years Experience" },
    { value: "4.8", label: "Google Rating" },
    { value: "Licensed", label: "& Insured" },
  ],
  services: [
    { title: "Storm Damage Repair", desc: "When storms strike, we respond fast. Emergency tarping, full damage assessment, and insurance claim assistance from start to finish.", image: "https://images.unsplash.com/photo-1632759145351-1d592919f522?w=800&q=80" },
    { title: "Roof Replacement", desc: "Complete tear-off and replacement with premium materials. We handle everything from permits to final inspection, leaving your home protected for decades.", image: "https://images.unsplash.com/photo-1635424710928-0544e8512eae?w=800&q=80" },
    { title: "Gutters & Exteriors", desc: "Seamless gutter installation, siding repair, and exterior maintenance. We protect every side of your home, not just the top.", image: "/roofing-gutters.png" },
  ],
  reasons: [
    { num: "01", title: "Licensed & Insured", desc: "$2M liability coverage on every job. Your home is fully protected." },
    { num: "02", title: "Free Storm Inspections", desc: "We inspect your roof after any major storm at no charge, no obligation." },
    { num: "03", title: "Insurance Claim Help", desc: "We work directly with your insurance company and handle all the paperwork." },
    { num: "04", title: "10-Year Warranty", desc: "Our workmanship is guaranteed. If anything goes wrong, we make it right." },
  ],
  testimonials: [
    { name: "Dave & Linda M.", location: "Sterling Heights, MI", text: "Summit replaced our entire roof in two days after the July storm. They handled the insurance claim from start to finish. Couldn't have been easier." },
    { name: "Rachel K.", location: "Troy, MI", text: "I got three quotes and Summit was the most thorough by far. They found hail damage I didn't even know about. Professional crew, great cleanup." },
    { name: "Tom P.", location: "Shelby Township, MI", text: "Called them on a Sunday after a tree branch punctured our roof. They had a tarp up within 2 hours. Replacement done that same week. Highly recommend." },
  ],
  cta: { title: "Don't Wait for the Next Storm.", subtitle: "Schedule your free inspection today. We respond to every inquiry within 15 minutes.", phone: "(586) 555-0287" },
  footer: { desc: "Trusted residential roofing and exterior services in Sterling Heights, Michigan and surrounding communities since 2009.", address: "14280 Lakeside Circle\nSterling Heights, MI 48313", phone: "(586) 555-0287", license: "Licensed & Insured — State of Michigan" },
  chatTrade: "roofing",
};

export default function RoofingPage() {
  return <NicheLandingPage config={config} />;
}
