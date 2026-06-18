import { mount } from "svelte";
import "./app.css";
import App from "./App.svelte";

// Clear the SEO fallback content inside #app before mounting Svelte.
// The fallback is the visible H1 + intro + dialect anchors that ship in the
// initial HTML so Googlebot's first-pass crawl (no JS execution) sees real
// crawlable content, not just an empty <div id="app"></div>. Without this
// clear, mount() would append the Svelte tree alongside the fallback, leaving
// a duplicate "Learn Swiss German with AI" block above the real UI.
const target = document.getElementById("app")!;
target.replaceChildren();
const app = mount(App, { target });
export default app;
