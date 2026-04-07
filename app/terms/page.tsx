const T = {
  bg: "#0D1426",
  text: "#e8eaf0",
  muted: "#b0b4c8",
  orange: "#E86A2A",
  border: "rgba(255,255,255,0.07)",
};

export const metadata = {
  title: "Terms of Service — The Wolf Pack Co",
  description: "Read The Wolf Pack Co's terms of service for digital marketing and CRM services.",
};

export default function TermsOfService() {
  return (
    <div style={{ background: T.bg, minHeight: "100vh", fontFamily: "'Inter', system-ui, sans-serif", color: T.text }}>
      <main style={{ maxWidth: 760, margin: "0 auto", padding: "80px 24px" }}>
        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(28px, 6vw, 42px)", letterSpacing: 2, marginBottom: 6 }}>Terms of Service</h1>
        <p style={{ color: T.muted, marginBottom: 40 }}>Last updated: March 2026</p>

        <p style={{ color: T.muted, lineHeight: 1.8, marginBottom: 28 }}>These Terms of Service ("Terms") govern your use of the services provided by The Wolf Pack Co ("we," "us," or "our"), including our website at thewolfpackco.com and all related services. By using our services, you agree to these Terms.</p>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: T.orange, marginTop: 36, marginBottom: 12 }}>1. Services</h2>
        <p style={{ color: T.muted, lineHeight: 1.8 }}>The Wolf Pack Co provides digital marketing services including lead generation, Meta and Google ad management, AI video creative, CRM software, and related tools. Features and pricing are described on our website and may change over time.</p>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: T.orange, marginTop: 36, marginBottom: 12 }}>2. Eligibility</h2>
        <p style={{ color: T.muted, lineHeight: 1.8 }}>You must be at least 18 years old to use our services. By using our services, you represent that you have the authority to enter into these Terms.</p>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: T.orange, marginTop: 36, marginBottom: 12 }}>3. Subscriptions and Billing</h2>
        <p style={{ color: T.muted, lineHeight: 1.8, marginBottom: 12 }}>Certain services require a paid subscription or one-time payment. Plans and pricing are listed on our website. Subscriptions are billed monthly in advance. All fees are non-refundable except as required by law.</p>
        <p style={{ color: T.muted, lineHeight: 1.8 }}>We reserve the right to change pricing with 30 days notice.</p>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: T.orange, marginTop: 36, marginBottom: 12 }}>4. SMS Messaging Consent</h2>
        <p style={{ color: T.muted, lineHeight: 1.8, marginBottom: 12 }}>By providing your phone number through any of our forms, booking pages, or landing pages, and by checking the SMS consent checkbox, you expressly consent to receive automated SMS text messages from The Wolf Pack Co at the phone number provided. These messages may include:</p>
        <ul style={{ color: T.muted, lineHeight: 2, paddingLeft: 20 }}>
          <li>Appointment reminders and confirmations</li>
          <li>Follow-up messages related to your inquiry or service request</li>
          <li>Service-related updates and notifications</li>
          <li>Responses to your questions or requests</li>
        </ul>
        <p style={{ color: T.muted, lineHeight: 1.8, marginTop: 12, marginBottom: 12 }}><strong style={{ color: T.text }}>Consent is not a condition of purchase.</strong> You are not required to consent to receive SMS messages as a condition of purchasing any goods or services from us.</p>
        <p style={{ color: T.muted, lineHeight: 1.8, marginBottom: 12 }}><strong style={{ color: T.text }}>Message frequency:</strong> Message frequency varies based on your interactions. Typically 1-5 messages per week.</p>
        <p style={{ color: T.muted, lineHeight: 1.8, marginBottom: 12 }}><strong style={{ color: T.text }}>Message and data rates may apply.</strong> Your mobile carrier&apos;s standard messaging rates apply to all SMS messages sent and received.</p>
        <p style={{ color: T.muted, lineHeight: 1.8, marginBottom: 12 }}><strong style={{ color: T.text }}>Opt-out:</strong> You may opt out at any time by replying <strong style={{ color: T.text }}>STOP</strong> to any SMS message. You will receive one final confirmation message and no further messages will be sent. You may also email info@thewolfpackco.com to opt out.</p>
        <p style={{ color: T.muted, lineHeight: 1.8, marginBottom: 12 }}><strong style={{ color: T.text }}>Help:</strong> Reply <strong style={{ color: T.text }}>HELP</strong> for assistance, or contact info@thewolfpackco.com or (586) 237-8743.</p>
        <p style={{ color: T.muted, lineHeight: 1.8, marginBottom: 12 }}><strong style={{ color: T.text }}>Supported carriers:</strong> SMS messaging is supported on all major US carriers including AT&amp;T, Verizon, T-Mobile, Sprint, and others.</p>
        <p style={{ color: T.muted, lineHeight: 1.8 }}><strong style={{ color: T.text }}>No mobile information will be shared with third parties/affiliates for marketing/promotional purposes.</strong> We do not sell, rent, or share your phone number, opt-in data, or consent information with any third parties.</p>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: T.orange, marginTop: 36, marginBottom: 12 }}>5. AI-Powered Communications</h2>
        <p style={{ color: T.muted, lineHeight: 1.8 }}>Some of our SMS and email communications are generated or assisted by artificial intelligence. By consenting to receive messages, you acknowledge that some responses may be AI-generated. AI responses are informational and do not constitute professional advice. A human team member can take over any conversation upon request.</p>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: T.orange, marginTop: 36, marginBottom: 12 }}>6. Acceptable Use</h2>
        <p style={{ color: T.muted, lineHeight: 1.8, marginBottom: 12 }}>You agree not to:</p>
        <ul style={{ color: T.muted, lineHeight: 2, paddingLeft: 20 }}>
          <li>Provide false or misleading information</li>
          <li>Use our services to violate any applicable law</li>
          <li>Attempt to reverse engineer or extract source code from our platform</li>
          <li>Share your account credentials with unauthorized parties</li>
          <li>Upload or transmit malicious code or content</li>
        </ul>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: T.orange, marginTop: 36, marginBottom: 12 }}>7. Intellectual Property</h2>
        <p style={{ color: T.muted, lineHeight: 1.8 }}>Our services, including software, design, and content, are owned by The Wolf Pack Co and protected by intellectual property laws. Ad creatives and video content produced for you are licensed for your use in advertising.</p>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: T.orange, marginTop: 36, marginBottom: 12 }}>8. Disclaimer of Warranties</h2>
        <p style={{ color: T.muted, lineHeight: 1.8 }}>Our services are provided "as is" without warranties of any kind. We do not guarantee specific lead volumes, conversion rates, or advertising results. Ad performance depends on many factors outside our control.</p>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: T.orange, marginTop: 36, marginBottom: 12 }}>9. Limitation of Liability</h2>
        <p style={{ color: T.muted, lineHeight: 1.8 }}>To the maximum extent permitted by law, The Wolf Pack Co shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of our services. Our total liability shall not exceed the amount you paid us in the 3 months preceding the claim.</p>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: T.orange, marginTop: 36, marginBottom: 12 }}>10. Termination</h2>
        <p style={{ color: T.muted, lineHeight: 1.8 }}>You may cancel your subscription at any time. Cancellation takes effect at the end of your current billing period. We may suspend or terminate your account for violation of these Terms.</p>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: T.orange, marginTop: 36, marginBottom: 12 }}>11. Governing Law</h2>
        <p style={{ color: T.muted, lineHeight: 1.8 }}>These Terms are governed by the laws of the State of Michigan, United States. Any disputes shall be resolved in the courts of Michigan.</p>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: T.orange, marginTop: 36, marginBottom: 12 }}>12. Changes to These Terms</h2>
        <p style={{ color: T.muted, lineHeight: 1.8 }}>We may update these Terms from time to time. Continued use of our services after changes take effect constitutes acceptance.</p>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: T.orange, marginTop: 36, marginBottom: 12 }}>13. Contact</h2>
        <p style={{ color: T.muted, lineHeight: 1.8 }}>Questions about these Terms? Contact us at:</p>
        <p style={{ color: T.muted, lineHeight: 1.8 }}>
          The Wolf Pack Co<br />
          1950 S Rochester Rd #1217<br />
          Rochester Hills, MI 48307<br />
          <a href="mailto:info@thewolfpackco.com" style={{ color: T.orange }}>info@thewolfpackco.com</a><br />
          <a href="tel:+15862378743" style={{ color: T.orange }}>(586) 237-8743</a>
        </p>
      </main>
    </div>
  );
}
