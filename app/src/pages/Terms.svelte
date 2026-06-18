<script lang="ts">
  import TopNav from "../components/TopNav.svelte";
  const lastUpdated = "May 15, 2026";
</script>

<TopNav current="" />

<main class="max-w-3xl mx-auto px-6 py-12">
  <h1 class="font-display font-extrabold text-4xl sm:text-5xl tracking-tight mb-2">Terms of Service</h1>
  <p class="text-sm text-ink/50 mb-10">Last updated: {lastUpdated}</p>

  <div class="prose prose-sm max-w-none space-y-6 text-ink/80 leading-relaxed [&_h2]:font-display [&_h2]:font-bold [&_h2]:text-2xl [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-ink [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-3 [&_li]:mb-1 [&_a]:text-ink [&_a]:underline">

  <p>These Terms of Service ("Terms") govern your use of rede.chat. By using the service you agree to these Terms. If you don't agree, please don't use the service.</p>

  <h2>1. The service</h2>
  <p>rede.chat is a conversational practice tool for Swiss German dialects. You talk with an AI that speaks the dialect of your choice; the AI may correct your mistakes and suggest improvements. The service is offered in beta and may change at any time.</p>

  <h2>2. Who can use it</h2>
  <p>You must be at least 16 years old (or the age of digital consent in your country, whichever is higher) to use rede.chat.</p>

  <h2>3. Account and access</h2>
  <p>You can use rede.chat anonymously with a small amount of free practice time. To get more time or save your progress, you create an account via email, Google, or Apple. You're responsible for keeping your account credentials secure.</p>

  <h2>4. Credits and payments</h2>
  <ul>
    <li>You purchase credits as one-time packs. There is no subscription.</li>
    <li>Credits don't expire.</li>
    <li>Credits are non-transferable and non-refundable except where required by law (e.g. the 14-day right of withdrawal under Swiss/EU consumer law). Because the service is digital content delivered immediately, by purchasing credits you expressly waive the right of withdrawal once you begin using them.</li>
    <li>Prices are in Swiss Francs (CHF) and include VAT where applicable.</li>
    <li>Payments are processed by Stripe under their terms.</li>
  </ul>

  <h2>5. Acceptable use</h2>
  <p>You agree not to:</p>
  <ul>
    <li>Abuse, harass, or threaten anyone, including the AI</li>
    <li>Use the service to generate or distribute illegal content</li>
    <li>Attempt to reverse-engineer, scrape, or overwhelm our infrastructure</li>
    <li>Resell credits or transfer your account</li>
    <li>Use multiple anonymous identities to circumvent free-tier limits beyond what's reasonable</li>
  </ul>

  <h2>6. AI output disclaimer</h2>
  <p>rede.chat uses generative AI (Google Gemini) to produce responses and corrections. AI output can be wrong, biased, or nonsensical. It is a practice aid, not a professional translator or language teacher. Don't rely on it for legal, medical, or other important communication. We make no warranty as to the accuracy or completeness of any output.</p>

  <h2>7. Your content</h2>
  <p>Anything you say to rede.chat is yours. We process it as described in our <a href="/privacy">Privacy Policy</a>. We don't store your audio or transcripts on our server; they stay on your device or are processed transiently by Gemini.</p>

  <h2>8. Intellectual property</h2>
  <p>The rede.chat name, logo, dialect prompts, and software are ours. The Swiss German dialect data (cultural references, phrases) comes from public knowledge.</p>

  <h2>9. Availability</h2>
  <p>rede.chat is provided "as is". We don't guarantee uptime. We may add, remove, or change features without notice during the beta period.</p>

  <h2>10. Termination</h2>
  <p>You may stop using rede.chat at any time and delete your account. We may suspend or terminate your access if you violate these Terms or use the service abusively.</p>

  <h2>11. Liability</h2>
  <p>To the extent permitted by law, our total liability for any claim arising out of your use of rede.chat is limited to the amount you've paid us in the last 12 months. We are not liable for indirect, consequential, or incidental damages.</p>

  <h2>12. Governing law and disputes</h2>
  <p>These Terms are governed by Swiss law. Any dispute will be resolved in the courts of Zürich, Switzerland, unless mandatory consumer protection law in your country of residence provides otherwise.</p>

  <h2>13. Changes</h2>
  <p>We may update these Terms. Material changes will be announced on this page and, if you have an account, by email. Continued use after a change means you accept the new Terms.</p>

  <h2>14. Contact</h2>
  <p>Questions about these Terms: <a href="mailto:gruezi@rede.chat">gruezi@rede.chat</a>.</p>

  </div>
</main>
