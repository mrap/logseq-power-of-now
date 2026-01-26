import "@logseq/libs";
import React from "react";
import proxyLogseq from "logseq-proxy";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

if (import.meta.env.VITE_MODE === "web") {
  // Run in browser for development
  console.log(
    "[Power of NOW] === meta.env.VITE_LOGSEQ_API_SERVER",
    import.meta.env.VITE_LOGSEQ_API_SERVER
  );
  console.log(
    `%c[Power of NOW]: v${__APP_VERSION__}`,
    "background-color: #60A5FA; color: white; padding: 4px;"
  );
  proxyLogseq({
    config: {
      apiServer: import.meta.env.VITE_LOGSEQ_API_SERVER,
      apiToken: import.meta.env.VITE_LOGSEQ_API_TOKEN,
    },
    settings: window.mockSettings,
  });
  renderApp();
} else {
  // Run as Logseq plugin
  console.log("=== Power of NOW plugin loaded ===");
  logseq.ready(() => {
    // Position the iframe at the bottom - height will be controlled by the App component
    logseq.setMainUIInlineStyle({
      position: "fixed",
      bottom: "0",
      left: "0",
      right: "0",
      top: "auto",
      height: "250px",
      zIndex: "999",
      background: "transparent",
    });

    // Hide snooze properties and show minimal indicator
    logseq.provideStyle(`
      /* Hide snoozed-until and snoozed-at property rows */
      .block-properties > div:has(a[data-ref="snoozed-until"]),
      .block-properties > div:has(a[data-ref="snoozed-at"]) {
        display: none !important;
      }

      /* Snooze indicator - small orange dot in left margin */
      .ls-block:has(a[data-ref="snoozed-until"]) > .block-main-container::before {
        content: "";
        position: absolute;
        left: -8px;
        top: 50%;
        transform: translateY(-50%);
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background-color: #f59e0b;
        opacity: 0.8;
      }
    `);

    // Register snooze keyboard shortcut
    logseq.App.registerCommandPalette(
      {
        key: "snooze-current-block",
        label: "Snooze current block",
        keybinding: { binding: "ctrl+s" },
      },
      async () => {
        const block = await logseq.Editor.getCurrentBlock();
        if (block) {
          // Dispatch custom event to React app with block info
          const event = new CustomEvent("power-of-now:snooze-block", {
            detail: {
              uuid: block.uuid,
              content: block.content || "",
            },
          });
          window.dispatchEvent(event);
        } else {
          logseq.UI.showMsg("No block selected", "warning");
        }
      }
    );

    // Render and show the app immediately
    renderApp();
    logseq.showMainUI();
  });
}

function renderApp() {
  const rootElement = document.getElementById("root")!;
  // Clear any stale content from previous plugin session
  rootElement.innerHTML = "";
  const root = createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
