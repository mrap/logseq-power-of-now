import { useState, useEffect, useCallback } from "react";
import { useNowTasks } from "./hooks/useNowTasks";
import { useWaitingTasks } from "./hooks/useWaitingTasks";
import { useTodayTasks } from "./hooks/useTodayTasks";
import { useSnoozedTasks } from "./hooks/useSnoozedTasks";
import { NowTaskItem } from "./components/NowTaskItem";
import { WaitingTaskItem } from "./components/WaitingTaskItem";
import { TodayTaskItem } from "./components/TodayTaskItem";
import { SnoozedTaskItem } from "./components/SnoozedTaskItem";
import { SnoozeModal } from "./components/SnoozeModal";
import "./App.css";

type ViewMode = "NOW" | "WAITING" | "TODAY" | "SNOOZED";

interface SnoozeTarget {
  uuid: string;
  content: string;
}

const COLLAPSED_HEIGHT = "32px";
const EXPANDED_HEIGHT = "250px";

const App = () => {
  const { tasks: nowTasks, loading: nowLoading } = useNowTasks();
  const { tasks: waitingTasks, loading: waitingLoading } = useWaitingTasks();
  const {
    nowTasks: todayNowTasks,
    todoLaterTasks,
    waitingTasks: todayWaitingTasks,
    loading: todayLoading,
  } = useTodayTasks();
  const {
    resurfacedTasks,
    pendingTasks,
    loading: snoozedLoading,
    refetch: refetchSnoozed,
    unreadCount,
    markAllSeen,
  } = useSnoozedTasks();
  const [collapsed, setCollapsed] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("TODAY");
  const [snoozeTarget, setSnoozeTarget] = useState<SnoozeTarget | null>(null);

  const todayTaskCount =
    todayNowTasks.length + todoLaterTasks.length + todayWaitingTasks.length;
  const snoozedTaskCount = resurfacedTasks.length + pendingTasks.length;

  // Listen for snooze keyboard shortcut event from main.tsx
  useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<SnoozeTarget>;
      setSnoozeTarget(customEvent.detail);
    };
    window.addEventListener("power-of-now:snooze-block", handler);
    return () => window.removeEventListener("power-of-now:snooze-block", handler);
  }, []);

  // Handle snooze action - write properties to block
  const handleSnooze = useCallback(
    async (blockUuid: string, until: Date) => {
      try {
        const now = new Date();
        await logseq.Editor.upsertBlockProperty(
          blockUuid,
          "snoozed-until",
          until.toISOString()
        );
        await logseq.Editor.upsertBlockProperty(
          blockUuid,
          "snoozed-at",
          now.toISOString()
        );
        logseq.UI.showMsg(`Snoozed until ${until.toLocaleString()}`, "success");
        refetchSnoozed();
      } catch (err) {
        console.error("Failed to snooze block:", err);
        logseq.UI.showMsg("Failed to snooze block", "error");
      }
    },
    [refetchSnoozed]
  );

  // Dynamically resize the iframe based on collapsed state
  useEffect(() => {
    if (typeof logseq !== "undefined" && logseq.setMainUIInlineStyle) {
      logseq.setMainUIInlineStyle({
        height: collapsed ? COLLAPSED_HEIGHT : EXPANDED_HEIGHT,
      });
    }
  }, [collapsed]);

  // Don't show the bar if there are no tasks in any view
  if (
    !nowLoading &&
    !waitingLoading &&
    !todayLoading &&
    !snoozedLoading &&
    nowTasks.length === 0 &&
    waitingTasks.length === 0 &&
    todayTaskCount === 0 &&
    snoozedTaskCount === 0
  ) {
    return null;
  }

  return (
    <div className="power-of-now-bar">
      <div className="bar-header">
        <div className="view-toggle">
          <button
            className={`view-toggle-btn ${viewMode === "TODAY" ? "active" : ""}`}
            onClick={() => setViewMode("TODAY")}
          >
            TODAY
            <span className="bar-count">
              {todayLoading ? "..." : todayTaskCount}
            </span>
          </button>
          <button
            className={`view-toggle-btn ${viewMode === "NOW" ? "active" : ""}`}
            onClick={() => setViewMode("NOW")}
          >
            NOW
            <span className="bar-count">{nowLoading ? "..." : nowTasks.length}</span>
          </button>
          <button
            className={`view-toggle-btn ${viewMode === "WAITING" ? "active" : ""}`}
            onClick={() => setViewMode("WAITING")}
          >
            WAITING
            <span className="bar-count">{waitingLoading ? "..." : waitingTasks.length}</span>
          </button>
          <button
            className={`view-toggle-btn ${viewMode === "SNOOZED" ? "active" : ""}`}
            onClick={() => {
              setViewMode("SNOOZED");
              markAllSeen();
            }}
          >
            SNOOZED
            <span className="bar-count">
              {snoozedLoading ? "..." : snoozedTaskCount}
            </span>
            {unreadCount > 0 && (
              <span className="bar-badge">{unreadCount}</span>
            )}
          </button>
        </div>
        <span className="bar-toggle" onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? "▲" : "▼"}
        </span>
      </div>

      {!collapsed && (
        <div className="bar-content">
          {/* NOW View */}
          {viewMode === "NOW" && (
            <>
              {nowLoading && <div className="bar-loading">Loading...</div>}
              {!nowLoading && nowTasks.length > 0 && (
                <div className="task-list">
                  {nowTasks.map((task) => (
                    <NowTaskItem key={task.uuid} task={task} />
                  ))}
                </div>
              )}
              {!nowLoading && nowTasks.length === 0 && (
                <div className="bar-empty">No now tasks</div>
              )}
            </>
          )}

          {/* WAITING View */}
          {viewMode === "WAITING" && (
            <>
              {waitingLoading && <div className="bar-loading">Loading...</div>}
              {!waitingLoading && waitingTasks.length > 0 && (
                <div className="task-list">
                  {waitingTasks.map((task) => (
                    <WaitingTaskItem key={task.uuid} task={task} />
                  ))}
                </div>
              )}
              {!waitingLoading && waitingTasks.length === 0 && (
                <div className="bar-empty">No waiting tasks</div>
              )}
            </>
          )}

          {/* TODAY View */}
          {viewMode === "TODAY" && (
            <>
              {todayLoading && <div className="bar-loading">Loading...</div>}
              {!todayLoading && todayTaskCount > 0 && (
                <div className="task-list">
                  {todayNowTasks.length > 0 && (
                    <div className="today-group">
                      <div className="today-group-header">NOW</div>
                      {todayNowTasks.map((task) => (
                        <TodayTaskItem key={task.uuid} task={task} />
                      ))}
                    </div>
                  )}
                  {todoLaterTasks.length > 0 && (
                    <div className="today-group">
                      <div className="today-group-header">TODO / LATER</div>
                      {todoLaterTasks.map((task) => (
                        <TodayTaskItem key={task.uuid} task={task} />
                      ))}
                    </div>
                  )}
                  {todayWaitingTasks.length > 0 && (
                    <div className="today-group">
                      <div className="today-group-header">WAITING</div>
                      {todayWaitingTasks.map((task) => (
                        <TodayTaskItem key={task.uuid} task={task} />
                      ))}
                    </div>
                  )}
                </div>
              )}
              {!todayLoading && todayTaskCount === 0 && (
                <div className="bar-empty">No tasks on today's journal</div>
              )}
            </>
          )}

          {/* SNOOZED View */}
          {viewMode === "SNOOZED" && (
            <>
              {snoozedLoading && <div className="bar-loading">Loading...</div>}
              {!snoozedLoading && snoozedTaskCount > 0 && (
                <div className="task-list">
                  {resurfacedTasks.length > 0 && (
                    <div className="snoozed-group">
                      <div className="snoozed-group-header resurfaced">RESURFACED</div>
                      {resurfacedTasks.map((task) => (
                        <SnoozedTaskItem
                          key={task.uuid}
                          task={task}
                          onRefetch={refetchSnoozed}
                          onResnooze={handleSnooze}
                        />
                      ))}
                    </div>
                  )}
                  {pendingTasks.length > 0 && (
                    <div className="snoozed-group">
                      <div className="snoozed-group-header pending">PENDING</div>
                      {pendingTasks.map((task) => (
                        <SnoozedTaskItem
                          key={task.uuid}
                          task={task}
                          onRefetch={refetchSnoozed}
                          onResnooze={handleSnooze}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
              {!snoozedLoading && snoozedTaskCount === 0 && (
                <div className="bar-empty">No snoozed tasks</div>
              )}
            </>
          )}
        </div>
      )}

      {/* Snooze Modal */}
      {snoozeTarget && (
        <SnoozeModal
          blockUuid={snoozeTarget.uuid}
          blockContent={snoozeTarget.content}
          onClose={() => setSnoozeTarget(null)}
          onSnooze={handleSnooze}
        />
      )}
    </div>
  );
};

export default App;
