import "./style/main.less";
import { createApp } from "vue";
import App from "./App.vue";
import { AutomationEngine } from "./AutomationEngine";

function tryMountOverlay() {
  if (!window.location.href.includes("/learn/course/")) return;
  if (document.getElementById("ia-vue-root")) return; // Already mounted

  console.log(
    "[Inservice Assistant] Course page detected. Rendering UI overlay..."
  );
  const hostDiv = document.createElement("div");
  hostDiv.id = "ia-vue-root";
  document.body.appendChild(hostDiv);
  createApp(App).mount(hostDiv);
}

async function main() {
  const isMainFrame = window.top === window.self;

  if (isMainFrame) {
    // Attempt to mount immediately (for direct page loads)
    tryMountOverlay();

    // Also watch for SPA route changes (e.g., after login redirect via pushState)
    let lastUrl = window.location.href;
    setInterval(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        // URL changed — try mounting the overlay if we're now on a course page
        setTimeout(tryMountOverlay, 600); // Short delay for SPA DOM to settle
      }
    }, 500);
  } else {
    // Iframe context: run a headless engine that reads sessionStorage for state.
    console.log(
      "[Inservice Assistant] Iframe frame detected. Running headless engine..."
    );
    const engine = new AutomationEngine((msg) => {
      window.top?.postMessage({ type: "IA_LOG", message: msg }, "*");
    });

    setInterval(() => {
      let isAutomating = false;
      try {
        isAutomating = sessionStorage.getItem("ia_automating") === "true";
      } catch (e) {}

      engine.setAutomating(isAutomating);
    }, 1500);
  }
}

main().catch((e) => {
  console.log(e);
});
