<script lang="ts">
  import { lang, setLanguage, pickerLanguages } from "../lib/i18n.svelte";
  import { findLanguage } from "../lib/languages";

  const languages = pickerLanguages();
  let open = $state(false);
  let current = $derived(findLanguage(lang.code));

  function pick(code: string) {
    setLanguage(code);
    open = false;
  }

  function handleOutsideClick(e: MouseEvent) {
    if (!(e.target as HTMLElement).closest("[data-lang-picker]")) open = false;
  }

  $effect(() => {
    if (open) {
      document.addEventListener("click", handleOutsideClick);
      return () => document.removeEventListener("click", handleOutsideClick);
    }
  });
</script>

<div data-lang-picker class="relative inline-block">
  <button
    onclick={() => open = !open}
    class="px-3 py-1.5 rounded-md bg-cream/80 backdrop-blur border border-ink/15 text-sm font-medium hover:border-ink/30 transition flex items-center gap-1.5"
    aria-haspopup="listbox"
    aria-expanded={open}
  >
    <span>{current?.name ?? "Language"}</span>
    <svg width="10" height="10" viewBox="0 0 10 10" class="opacity-50">
      <path d="M2 4l3 3 3-3" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </button>

  {#if open}
    <ul
      role="listbox"
      class="absolute top-full right-0 mt-1 min-w-[180px] max-h-[60vh] overflow-y-auto bg-cream border border-ink/15 rounded-md shadow-lg py-1"
    >
      {#each languages as l (l.code)}
        <li>
          <button
            role="option"
            aria-selected={lang.code === l.code}
            onclick={() => pick(l.code)}
            class="w-full text-left px-3 py-1.5 text-sm hover:bg-ink/5
              {lang.code === l.code ? 'font-semibold' : ''}"
          >
            {l.name}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>
