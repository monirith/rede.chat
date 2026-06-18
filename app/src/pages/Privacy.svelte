<script lang="ts">
  import TopNav from "../components/TopNav.svelte";
  const lastUpdated = "May 15, 2026";
</script>

<TopNav current="" />

<main class="max-w-3xl mx-auto px-6 py-12">
  <h1 class="font-display font-extrabold text-4xl sm:text-5xl tracking-tight mb-2">Privacy Policy</h1>
  <p class="text-sm text-ink/50 mb-10">Last updated: {lastUpdated}</p>

  <div class="prose prose-sm max-w-none space-y-6 text-ink/80 leading-relaxed [&_h2]:font-display [&_h2]:font-bold [&_h2]:text-2xl [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-ink [&_h3]:font-semibold [&_h3]:text-lg [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-ink [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-3 [&_li]:mb-1 [&_a]:text-ink [&_a]:underline">

  <p>This Privacy Policy explains how rede.chat ("we", "us") handles your personal data when you use our Swiss German voice practice service at <a href="https://rede.chat">rede.chat</a>.</p>

  <h2>1. Who we are</h2>
  <p>rede.chat is operated as a personal project. For privacy questions, contact <a href="mailto:gruezi@rede.chat">gruezi@rede.chat</a>. We act as data controller for the processing described here.</p>

  <h2>2. What we collect and why</h2>

  <h3>Anonymous use</h3>
  <p>If you use rede.chat without signing in, we store on your device a random identifier (a UUID in your browser's localStorage) so we can track your free minutes and any sessions you start. The server only sees this identifier — never your name, email, or IP-derived location beyond what Cloudflare logs for abuse prevention.</p>

  <h3>Account</h3>
  <p>If you sign in, we receive your email address and the name your identity provider (Google, Apple) shares with us. We use this only to identify your account.</p>

  <h3>Practice sessions</h3>
  <p>For each conversation you have with the AI, we store on our server:</p>
  <ul>
    <li>The dialect and scenario you chose</li>
    <li>Start time, end time, and duration in seconds</li>
    <li>Number of tokens consumed (for cost accounting)</li>
    <li>A summary of language corrections the AI noticed (if any)</li>
  </ul>
  <p><strong>What we do NOT store on the server:</strong> the audio of your conversation, or the full transcript of what was said. Audio is streamed live to Google Gemini and discarded as soon as the session ends. Transcripts stay on your device only, in your browser's localStorage.</p>

  <h3>Vocabulary you save</h3>
  <p>When you save a phrase to your word book, we store the expression, its standard-German equivalent, and the AI's explanation on our server, tied to your account.</p>

  <h3>Payments</h3>
  <p>We use <a href="https://stripe.com/privacy">Stripe</a> to process credit pack purchases. We never see your card details. Stripe shares with us your purchase amount, a transaction reference, and your email (for the receipt). We keep that record for accounting and tax purposes.</p>

  <h3>Streaks and stats</h3>
  <p>We compute and store your practice streak (consecutive days), longest streak, and the date of your last session to display in your profile.</p>

  <h2>3. Third parties we share data with</h2>
  <ul>
    <li><strong>Google (Gemini API)</strong> — receives the audio of your conversation in real time for transcription, understanding, and response generation. Google's terms apply: <a href="https://policies.google.com/privacy">policies.google.com/privacy</a>. Audio is processed in the United States.</li>
    <li><strong>Cloudflare</strong> — hosts our website, API, authentication, and database (global edge). <a href="https://www.cloudflare.com/privacypolicy/">cloudflare.com/privacypolicy</a>.</li>
    <li><strong>PurelyMail</strong> — receives your email address to deliver login codes. <a href="https://purelymail.com/privacy">purelymail.com/privacy</a>.</li>
    <li><strong>Stripe</strong> — processes payments. <a href="https://stripe.com/privacy">stripe.com/privacy</a>.</li>
    <li><strong>SRF (Schweizer Radio und Fernsehen)</strong> — when you choose "News" as a scenario we fetch publicly available headlines from SRF's RSS feed.</li>
  </ul>

  <h2>4. International transfers</h2>
  <p>Audio sent to Google Gemini is processed in the United States. Stripe processes payments in the United States and the European Union. We rely on standard contractual clauses and the EU-US / Swiss-US Data Privacy Frameworks for these transfers.</p>

  <h2>5. Legal basis (GDPR / revFADP)</h2>
  <ul>
    <li><strong>Performance of a contract</strong> — to run sessions, manage your account, process purchases.</li>
    <li><strong>Legitimate interests</strong> — to prevent abuse, debug errors, improve the service.</li>
    <li><strong>Consent</strong> — granted explicitly when you tap "Start conversation" and approve microphone access in your browser.</li>
  </ul>

  <h2>6. Your rights</h2>
  <p>Under Swiss law (revFADP) and the EU GDPR you have the right to access, correct, delete, and export your data, and to withdraw consent at any time. To exercise these rights, email <a href="mailto:gruezi@rede.chat">gruezi@rede.chat</a>. We'll respond within 30 days.</p>
  <p>You can also delete your account directly from your profile page (when signed in). Deletion removes your account, session history, vocabulary, and streak data. Payment records are retained for the legal retention period required by Swiss accounting law.</p>

  <h2>7. Cookies and local storage</h2>
  <p>We do not use tracking cookies. We use your browser's localStorage to store:</p>
  <ul>
    <li>Your anonymous device id (so we can track free minutes)</li>
    <li>Your selected dialect and scenario (so they're remembered between visits)</li>
    <li>Your language preference</li>
    <li>Transcripts of your past sessions (only on your device)</li>
    <li>Your session token (only if you sign in)</li>
  </ul>

  <h2>8. Children</h2>
  <p>rede.chat is not directed at children under 16. We do not knowingly collect data from anyone under 16. If you believe a child has provided us data, please contact us and we'll delete it.</p>

  <h2>9. Security</h2>
  <p>Data in transit is encrypted with TLS. Audio to Gemini is over WSS. Our database and authentication are hosted on Cloudflare (D1). Authentication tokens are scoped and short-lived.</p>

  <h2>10. Retention</h2>
  <ul>
    <li>Account data: until you delete your account.</li>
    <li>Session metadata + corrections: until you delete your account.</li>
    <li>Payment records: 10 years (Swiss accounting law).</li>
    <li>Audio recordings: not retained.</li>
    <li>Server logs: 30 days, then aggregated/deleted.</li>
  </ul>

  <h2>11. Changes</h2>
  <p>We may update this policy. We'll change the "Last updated" date at the top and, for material changes, notify you by email if you have an account.</p>

  </div>
</main>
