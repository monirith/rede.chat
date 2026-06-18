<script lang="ts">
  import { t } from "../lib/i18n.svelte";
  import { DIALECTS } from "../lib/catalog";
  import LanguagePicker from "../components/LanguagePicker.svelte";
  import Wordmark from "../components/Wordmark.svelte";
  import DialectCard from "../components/DialectCard.svelte";

</script>

<main class="min-h-screen bg-cream text-ink">
  <header class="max-w-4xl mx-auto px-6 pt-6 flex items-center justify-between">
    <Wordmark size="lg" />
    <LanguagePicker />
  </header>

  <section class="max-w-4xl mx-auto px-6 pt-20 pb-12">
    <h1 class="font-display font-extrabold text-5xl md:text-6xl tracking-tight leading-tight">
      {t("landing.hero")}
    </h1>
    <p class="mt-6 text-xl text-ink/70 max-w-xl leading-relaxed">
      {t("landing.subhero")}
    </p>
    <div class="mt-8">
      <a href="/app" class="btn-primary text-base px-6 py-3">
        {t("landing.ctaStart")}
      </a>
    </div>
  </section>

  <section id="dialects" class="max-w-4xl mx-auto px-6 py-10">
    <h2 class="font-display font-bold text-2xl mb-4">{t("landing.dialectsTitle")}</h2>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
      {#each DIALECTS as d, i}
        <div class="{i === 12 ? 'col-start-2' : ''}">
          <DialectCard dialect={d} />
        </div>
      {/each}
    </div>
  </section>

  <section class="max-w-4xl mx-auto px-6 py-12">
    <h2 class="font-display font-bold text-2xl mb-6">{t("landing.howTitle")}</h2>
    <div class="space-y-4">
      <div class="card">
        <div class="font-semibold">{t("landing.step1Title")}</div>
        <div class="text-ink/60 text-sm mt-1">{t("landing.step1Body")}</div>
      </div>
      <div class="card">
        <div class="font-semibold">{t("landing.step2Title")}</div>
        <div class="text-ink/60 text-sm mt-1">{t("landing.step2Body")}</div>
      </div>
      <div class="card">
        <div class="font-semibold">{t("landing.step3Title")}</div>
        <div class="text-ink/60 text-sm mt-1">{t("landing.step3Body")}</div>
      </div>
    </div>
  </section>

  <footer class="max-w-4xl mx-auto px-6 py-10 text-sm text-ink/40">
    {t("landing.footer")}
  </footer>
</main>
