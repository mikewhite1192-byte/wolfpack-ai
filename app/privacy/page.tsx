const T = {
  bg: "#0D1426",
  text: "#e8eaf0",
  muted: "#b0b4c8",
  orange: "#E86A2A",
  border: "rgba(255,255,255,0.07)",
  surface: "#111827",
};

export const metadata = {
  title: "Privacy Policy — The Wolf Pack Co",
  description: "Read The Wolf Pack Co's privacy policy covering data collection, SMS messaging, and communication consent.",
};

export default function PrivacyPolicy() {
  return (
    <div style={{ background: T.bg, minHeight: "100vh", fontFamily: "'Inter', system-ui, sans-serif", color: T.text }}>
      <main style={{ maxWidth: 760, margin: "0 auto", padding: "80px 24px" }}>
        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(28px, 6vw, 42px)", letterSpacing: 2, marginBottom: 6 }}>Privacy Policy</h1>
        <p style={{ color: T.muted, marginBottom: 40 }}>Last updated: April 2026</p>

        <p style={{ color: T.muted, lineHeight: 1.8, marginBottom: 28 }}>The Wolf Pack Co ("we," "us," or "our") operates the website thewolfpackco.com and provides digital marketing, lead generation, and CRM services (the "Service"). This Privacy Policy explains how we collect, use, and protect your information.</p>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: T.orange, marginTop: 36, marginBottom: 12 }}>1. Information We Collect</h2>
        <p style={{ color: T.muted, lineHeight: 1.8, marginBottom: 12 }}><strong style={{ color: T.text }}>Contact information.</strong> When you fill out a form, book a call, or contact us, we collect your name, email address, phone number, and any other details you provide.</p>
        <p style={{ color: T.muted, lineHeight: 1.8, marginBottom: 12 }}><strong style={{ color: T.text }}>Phone number.</strong> We collect your phone number when you provide it through our forms, booking pages, or landing pages. Your phone number is used to send you SMS messages including appointment reminders, follow-up communications, and service-related notifications.</p>
        <p style={{ color: T.muted, lineHeight: 1.8, marginBottom: 12 }}><strong style={{ color: T.text }}>Usage data.</strong> We collect information about how you interact with our website, including pages visited and actions taken.</p>
        <p style={{ color: T.muted, lineHeight: 1.8, marginBottom: 12 }}><strong style={{ color: T.text }}>Payment information.</strong> Payments are processed by Stripe. We do not store your credit card details.</p>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: T.orange, marginTop: 36, marginBottom: 12 }}>2. How We Use Your Information</h2>
        <ul style={{ color: T.muted, lineHeight: 2, paddingLeft: 20 }}>
          <li>To provide, operate, and improve our services</li>
          <li>To communicate with you via email, phone, and SMS</li>
          <li>To send appointment reminders and confirmations via SMS</li>
          <li>To send follow-up messages related to your inquiry</li>
          <li>To process payments and manage subscriptions</li>
          <li>To respond to support requests</li>
          <li>To comply with legal obligations</li>
        </ul>
        <p style={{ color: T.muted, lineHeight: 1.8, marginTop: 12 }}>We do not sell your personal information to third parties.</p>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: T.orange, marginTop: 36, marginBottom: 12 }}>3. SMS Messaging & Communication</h2>
        <p style={{ color: T.muted, lineHeight: 1.8, marginBottom: 12 }}>By providing your phone number and checking the SMS consent checkbox on our forms, booking pages, or landing pages, you expressly consent to receive automated SMS text messages from The Wolf Pack Co at the phone number provided. These messages may include:</p>
        <ul style={{ color: T.muted, lineHeight: 2, paddingLeft: 20 }}>
          <li>Appointment reminders and confirmations</li>
          <li>Follow-up messages related to your inquiry or service request</li>
          <li>Service-related updates and notifications</li>
          <li>Responses to your questions or requests</li>
        </ul>
        <p style={{ color: T.muted, lineHeight: 1.8, marginTop: 12, marginBottom: 12 }}><strong style={{ color: T.text }}>Consent is not a condition of purchase.</strong> You are not required to consent to receive SMS messages as a condition of purchasing any goods or services.</p>
        <p style={{ color: T.muted, lineHeight: 1.8, marginBottom: 12 }}><strong style={{ color: T.text }}>Message frequency:</strong> Message frequency varies based on your interactions with us. Typically 1-5 messages per week.</p>
        <p style={{ color: T.muted, lineHeight: 1.8, marginBottom: 12 }}><strong style={{ color: T.text }}>Message and data rates may apply.</strong> Your mobile carrier&apos;s standard messaging rates apply to all SMS messages sent and received.</p>
        <p style={{ color: T.muted, lineHeight: 1.8, marginBottom: 12 }}><strong style={{ color: T.text }}>Opt-out:</strong> You can opt out of SMS messages at any time by replying <strong style={{ color: T.text }}>STOP</strong> to any message. After opting out, you will receive one final confirmation message and no further messages will be sent. You may also contact us at info@thewolfpackco.com to opt out.</p>
        <p style={{ color: T.muted, lineHeight: 1.8, marginBottom: 12 }}><strong style={{ color: T.text }}>Help:</strong> Reply <strong style={{ color: T.text }}>HELP</strong> to any message for assistance, or contact us at info@thewolfpackco.com or (586) 237-8743.</p>
        <p style={{ color: T.muted, lineHeight: 1.8, marginBottom: 12 }}><strong style={{ color: T.text }}>Supported carriers:</strong> SMS messaging is supported on all major US carriers including AT&amp;T, Verizon, T-Mobile, Sprint, and others.</p>
        <p style={{ color: T.muted, lineHeight: 1.8, marginBottom: 12 }}><strong style={{ color: T.text }}>No mobile information will be shared with third parties/affiliates for marketing/promotional purposes.</strong> All other categories exclude text messaging originator opt-in data and consent; this information will not be shared with any third parties.</p>
        <p style={{ color: T.muted, lineHeight: 1.8 }}>Phone numbers collected for SMS communications are used solely for the purposes described in this policy. We do not sell, rent, or share your phone number or SMS opt-in data with any third parties for their marketing purposes.</p>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: T.orange, marginTop: 36, marginBottom: 12 }}>4. AI-Powered Communications</h2>
        <p style={{ color: T.muted, lineHeight: 1.8, marginBottom: 12 }}>We use artificial intelligence to assist in responding to SMS messages and generating follow-up communications. AI-generated responses are designed to be helpful and relevant. A human team member oversees AI communications and can take over conversations at any time.</p>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: T.orange, marginTop: 36, marginBottom: 12 }}>5. Google Business Profile Integration</h2>
        <p style={{ color: T.muted, lineHeight: 1.8, marginBottom: 12 }}>When you connect your Google Business Profile to our CRM platform (thewolfpack.ai):</p>

        <p style={{ color: T.muted, lineHeight: 1.8, marginBottom: 8 }}><strong style={{ color: T.text }}>What We Access</strong></p>
        <ul style={{ color: T.muted, lineHeight: 2, paddingLeft: 20 }}>
          <li>Your Google Business Profile account and location information</li>
          <li>Business name, address, phone number, and categories</li>
          <li>Current photos and posts on your profile</li>
          <li>Profile performance metrics and insights</li>
        </ul>

        <p style={{ color: T.muted, lineHeight: 1.8, marginTop: 16, marginBottom: 8 }}><strong style={{ color: T.text }}>How We Use This Access</strong></p>
        <p style={{ color: T.muted, lineHeight: 1.8, marginBottom: 8 }}>We use your Google Business Profile connection to:</p>
        <ul style={{ color: T.muted, lineHeight: 2, paddingLeft: 20 }}>
          <li>Automatically post completed job photos and updates to your profile</li>
          <li>Create promotional posts you schedule in our CRM</li>
          <li>Display your current business information in your dashboard</li>
          <li>Track post performance and engagement metrics</li>
        </ul>

        <p style={{ color: T.muted, lineHeight: 1.8, marginTop: 16, marginBottom: 8 }}><strong style={{ color: T.text }}>What We Post</strong></p>
        <p style={{ color: T.muted, lineHeight: 1.8, marginBottom: 8 }}>We only post content that you create or approve within our CRM:</p>
        <ul style={{ color: T.muted, lineHeight: 2, paddingLeft: 20 }}>
          <li>Job completion updates with photos you upload</li>
          <li>Special offers and promotions you schedule</li>
          <li>Customer testimonials you approve</li>
          <li>Service availability updates you configure</li>
        </ul>
        <p style={{ color: T.muted, lineHeight: 1.8, marginTop: 12 }}>We never post anything automatically without your explicit permission via in-app settings.</p>

        <p style={{ color: T.muted, lineHeight: 1.8, marginTop: 16, marginBottom: 8 }}><strong style={{ color: T.text }}>Data Storage &amp; Security</strong></p>
        <ul style={{ color: T.muted, lineHeight: 2, paddingLeft: 20 }}>
          <li>Google OAuth tokens are encrypted using AES-256 encryption</li>
          <li>Tokens are stored securely in our database</li>
          <li>Access is limited to authorized system processes only</li>
          <li>We never share your Google credentials with third parties</li>
        </ul>

        <p style={{ color: T.muted, lineHeight: 1.8, marginTop: 16, marginBottom: 8 }}><strong style={{ color: T.text }}>Your Control</strong></p>
        <p style={{ color: T.muted, lineHeight: 1.8, marginBottom: 8 }}>You maintain full control over this integration:</p>
        <ul style={{ color: T.muted, lineHeight: 2, paddingLeft: 20 }}>
          <li>Enable or disable auto-posting features at any time in Settings</li>
          <li>Disconnect your Google Business Profile whenever you choose</li>
          <li>Delete all stored Google data by disconnecting the integration</li>
          <li>Revoke access directly through Google at: <a href="https://myaccount.google.com/permissions" style={{ color: T.orange }}>https://myaccount.google.com/permissions</a></li>
        </ul>

        <p style={{ color: T.muted, lineHeight: 1.8, marginTop: 16, marginBottom: 8 }}><strong style={{ color: T.text }}>Data Retention</strong></p>
        <p style={{ color: T.muted, lineHeight: 1.8, marginBottom: 8 }}>When you disconnect your Google Business Profile:</p>
        <ul style={{ color: T.muted, lineHeight: 2, paddingLeft: 20 }}>
          <li>All access tokens are immediately invalidated</li>
          <li>Stored Google data is deleted within 30 days</li>
          <li>Historical posts remain on your Google Business Profile (you control these through Google)</li>
        </ul>

        <p style={{ color: T.muted, lineHeight: 1.8, marginTop: 16, marginBottom: 8 }}><strong style={{ color: T.text }}>Third-Party Service</strong></p>
        <p style={{ color: T.muted, lineHeight: 1.8 }}>This integration uses Google&apos;s official APIs. Your use of Google Business Profile is also governed by Google&apos;s Terms of Service and Privacy Policy.</p>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: T.orange, marginTop: 36, marginBottom: 12 }}>6. Data Retention</h2>
        <p style={{ color: T.muted, lineHeight: 1.8 }}>We retain your personal information for as long as necessary to provide our services. If you request deletion of your data, we will remove it within 30 days, except where retention is required by law.</p>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: T.orange, marginTop: 36, marginBottom: 12 }}>7. Data Security</h2>
        <p style={{ color: T.muted, lineHeight: 1.8 }}>We use industry-standard security measures including encryption in transit (TLS) and at rest, access controls, and regular security reviews to protect your information.</p>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: T.orange, marginTop: 36, marginBottom: 12 }}>8. Third-Party Services</h2>
        <p style={{ color: T.muted, lineHeight: 1.8, marginBottom: 12 }}>We use the following third-party services:</p>
        <ul style={{ color: T.muted, lineHeight: 2, paddingLeft: 20 }}>
          <li><strong style={{ color: T.text }}>Stripe</strong> — payment processing</li>
          <li><strong style={{ color: T.text }}>Twilio</strong> — SMS messaging and voice communications</li>
          <li><strong style={{ color: T.text }}>Clerk</strong> — authentication and user management</li>
          <li><strong style={{ color: T.text }}>Neon</strong> — database hosting</li>
          <li><strong style={{ color: T.text }}>Vercel</strong> — website hosting</li>
          <li><strong style={{ color: T.text }}>Anthropic</strong> — AI language model processing</li>
          <li><strong style={{ color: T.text }}>Google</strong> — Business Profile integration and Calendar services</li>
        </ul>
        <p style={{ color: T.muted, lineHeight: 1.8, marginTop: 12 }}>Each provider processes data in accordance with their own privacy policies.</p>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: T.orange, marginTop: 36, marginBottom: 12 }}>9. Your Rights</h2>
        <p style={{ color: T.muted, lineHeight: 1.8 }}>You may request access to, correction of, or deletion of your personal information at any time by emailing us at <a href="mailto:info@thewolfpackco.com" style={{ color: T.orange }}>info@thewolfpackco.com</a>. We will respond within 30 days.</p>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: T.orange, marginTop: 36, marginBottom: 12 }}>10. Children</h2>
        <p style={{ color: T.muted, lineHeight: 1.8 }}>Our services are not directed to individuals under 18. We do not knowingly collect personal information from minors. You must be at least 18 years old to use our services or consent to receive SMS messages.</p>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: T.orange, marginTop: 36, marginBottom: 12 }}>11. Changes to This Policy</h2>
        <p style={{ color: T.muted, lineHeight: 1.8 }}>We may update this Privacy Policy from time to time. We will notify you of material changes by posting a notice on our website.</p>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: T.orange, marginTop: 36, marginBottom: 12 }}>12. Contact</h2>
        <p style={{ color: T.muted, lineHeight: 1.8 }}>Questions about this policy? Contact us at:</p>
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
