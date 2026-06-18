<script lang="ts">
  import { onMount } from "svelte";
  import { initAuth } from "./lib/auth";
  import { lang } from "./lib/i18n.svelte";
  import { router, initRouter, replace } from "./lib/router.svelte";

  import Home from "./pages/Home.svelte";
  import Session from "./pages/Session.svelte";
  import Feedback from "./pages/Feedback.svelte";
  import History from "./pages/History.svelte";
  import Phrasebook from "./pages/Phrasebook.svelte";
  import Credits from "./pages/Credits.svelte";
  import Profile from "./pages/Profile.svelte";
  import Privacy from "./pages/Privacy.svelte";
  import Terms from "./pages/Terms.svelte";

  let ready = $state(false);

  onMount(async () => {
    initRouter();
    const session = await initAuth();
    // Normalize the URL if an auth redirect left a hash fragment behind.
    if (location.hash) {
      replace(session ? "/app" : "/");
    }
    document.documentElement.lang = lang.code;
    ready = true;
  });
</script>

{#if ready}
  {#if router.path === "/" || router.path === "/app"}
    <Home />
  {:else if router.path === "/session"}
    <Session />
  {:else if router.path === "/feedback"}
    <Feedback />
  {:else if router.path === "/history"}
    <History />
  {:else if router.path === "/phrasebook"}
    <Phrasebook />
  {:else if router.path === "/credits"}
    <Credits />
  {:else if router.path === "/profile"}
    <Profile />
  {:else if router.path === "/privacy"}
    <Privacy />
  {:else if router.path === "/terms"}
    <Terms />
  {:else}
    <Home />
  {/if}
{:else}
  <div class="min-h-screen flex items-center justify-center text-ink/40">…</div>
{/if}
