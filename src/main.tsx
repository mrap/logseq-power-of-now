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

    // Hide snooze properties and show indicator; style estimate property
    logseq.provideStyle(`
      /* Hide snoozed-until and snoozed-at property rows */
      .block-properties > div:has(a[data-ref="snoozed-until"]),
      .block-properties > div:has(a[data-ref="snoozed-at"]) {
        display: none !important;
      }

      /* Snooze indicator - orange ring around bullet */
      .ls-block[data-refs-self*="snoozed-until"] .bullet-container .bullet,
      .ls-block[data-refs-self*="snoozed-until"] .bullet-container .bullet::before {
        box-shadow: 0 0 0 2px #f59e0b;
      }

      /* Estimate indicator - blue ring around bullet */
      .ls-block[data-refs-self*="estimated-time"] .bullet-container .bullet,
      .ls-block[data-refs-self*="estimated-time"] .bullet-container .bullet::before {
        box-shadow: 0 0 0 2px #3b82f6;
      }

      /* If block has both snooze and estimate, show both colors (estimate takes priority visually) */
      .ls-block[data-refs-self*="snoozed-until"][data-refs-self*="estimated-time"] .bullet-container .bullet,
      .ls-block[data-refs-self*="snoozed-until"][data-refs-self*="estimated-time"] .bullet-container .bullet::before {
        box-shadow: 0 0 0 2px #3b82f6, 0 0 0 4px #f59e0b;
      }

      /* Style the estimated-time property row */
      .block-properties > div:has(a[data-ref="estimated-time"]) {
        background-color: rgba(59, 130, 246, 0.1);
        border-radius: 4px;
        padding: 2px 6px;
        margin: 2px 0;
      }

      .block-properties > div:has(a[data-ref="estimated-time"]) a[data-ref="estimated-time"] {
        color: #3b82f6;
        font-weight: 600;
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

    // Register estimate keyboard shortcut
    logseq.App.registerCommandPalette(
      {
        key: "estimate-current-block",
        label: "Set time estimate for current block",
        keybinding: { binding: "ctrl+e" },
      },
      async () => {
        const block = await logseq.Editor.getCurrentBlock();
        if (block) {
          // Dispatch custom event to React app with block info
          const event = new CustomEvent("power-of-now:estimate-block", {
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

    // Register priority keyboard shortcuts
    logseq.App.registerCommandPalette(
      {
        key: "set-priority-a",
        label: "Set priority A on current block",
        keybinding: { binding: "ctrl+1" },
      },
      async () => {
        await setPriorityOnCurrentBlock("A");
      }
    );

    logseq.App.registerCommandPalette(
      {
        key: "set-priority-b",
        label: "Set priority B on current block",
        keybinding: { binding: "ctrl+2" },
      },
      async () => {
        await setPriorityOnCurrentBlock("B");
      }
    );

    logseq.App.registerCommandPalette(
      {
        key: "set-priority-c",
        label: "Set priority C on current block",
        keybinding: { binding: "ctrl+3" },
      },
      async () => {
        await setPriorityOnCurrentBlock("C");
      }
    );

    logseq.App.registerCommandPalette(
      {
        key: "remove-priority",
        label: "Remove priority from current block",
        keybinding: { binding: "ctrl+`" },
      },
      async () => {
        await removePriorityFromCurrentBlock();
      }
    );

    // Register toggle hidden blocks shortcut
    logseq.App.registerCommandPalette(
      {
        key: "toggle-hidden-blocks",
        label: "Toggle visibility of hidden (done/snoozed) blocks",
        keybinding: { binding: "ctrl+," },
      },
      () => {
        window.dispatchEvent(new CustomEvent("power-of-now:toggle-visibility"));
      }
    );

    // Render and show the app immediately
    renderApp();
    logseq.showMainUI();
  });
}

/**
 * Set priority marker on the current block.
 * Removes existing priority and inserts new one after header and/or task marker if present.
 */
async function setPriorityOnCurrentBlock(priority: "A" | "B" | "C") {
  const block = await logseq.Editor.getCurrentBlock();
  if (!block) {
    logseq.UI.showMsg("No block selected", "warning");
    return;
  }

  const content = block.content || "";

  // Remove existing priority marker if any
  let newContent = content.replace(/\[#[ABC]\]\s*/gi, "");

  // Match optional header prefix (# ## ### etc.) and optional task marker
  const prefixMatch = newContent.match(/^(#{1,6}\s+)?(NOW|TODO|LATER|WAITING|DONE)?\s*/i);

  if (prefixMatch && (prefixMatch[1] || prefixMatch[2])) {
    const header = prefixMatch[1] || "";
    const taskMarker = prefixMatch[2] || "";
    const rest = newContent.slice(prefixMatch[0].length);

    if (taskMarker) {
      newContent = `${header}${taskMarker} [#${priority}] ${rest}`;
    } else {
      newContent = `${header}[#${priority}] ${rest}`;
    }
  } else {
    // No header or task marker - prepend priority
    newContent = `[#${priority}] ${newContent}`;
  }

  await logseq.Editor.updateBlock(block.uuid, newContent);
}

/**
 * Remove priority marker from the current block.
 */
async function removePriorityFromCurrentBlock() {
  const block = await logseq.Editor.getCurrentBlock();
  if (!block) {
    logseq.UI.showMsg("No block selected", "warning");
    return;
  }

  const content = block.content || "";

  // Remove priority marker and any extra whitespace
  const newContent = content.replace(/\[#[ABC]\]\s*/gi, "");

  // Only update if content actually changed
  if (newContent !== content) {
    await logseq.Editor.updateBlock(block.uuid, newContent);
  }
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
