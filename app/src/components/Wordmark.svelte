<script lang="ts">
  let { size = "base" }: { size?: "sm" | "base" | "lg" } = $props();

  let flagSize = $derived(size === "lg" ? 22 : size === "sm" ? 16 : 18);
  let textClass = $derived(size === "lg" ? "text-xl" : size === "sm" ? "text-base" : "text-lg");
</script>

<a href="/" class="inline-flex items-center gap-2 font-display font-bold {textClass} tracking-tight text-ink hover:text-ink/80">
  <svg width={flagSize} height={flagSize} viewBox="0 0 32 32" class="rounded-sm shrink-0" aria-hidden="true">
    <rect width="32" height="32" fill="#da291c"/>
    <rect x="13" y="6" width="6" height="20" fill="white"/>
    <rect x="6" y="13" width="20" height="6" fill="white"/>
  </svg>
  <span>rede.chat</span>
</a>
