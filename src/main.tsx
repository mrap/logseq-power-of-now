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

    // Render and show the app immediately
    renderApp();
    logseq.showMainUI();
  });
}

function renderApp() {
  const root = createRoot(document.getElementById("root")!);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
