import { useState, useEffect } from "react";
import { useNowTasks } from "./hooks/useNowTasks";
import { useWaitingTasks } from "./hooks/useWaitingTasks";
import { NowTaskItem } from "./components/NowTaskItem";
import { WaitingTaskItem } from "./components/WaitingTaskItem";
import "./App.css";

type ViewMode = "NOW" | "WAITING";

const COLLAPSED_HEIGHT = "32px";
const EXPANDED_HEIGHT = "250px";

const App = () => {
  const { tasks: nowTasks, loading: nowLoading } = useNowTasks();
  const { tasks: waitingTasks, loading: waitingLoading } = useWaitingTasks();
  const [collapsed, setCollapsed] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("NOW");

  const tasks = viewMode === "NOW" ? nowTasks : waitingTasks;
  const loading = viewMode === "NOW" ? nowLoading : waitingLoading;

  // Dynamically resize the iframe based on collapsed state
  useEffect(() => {
    if (typeof logseq !== "undefined" && logseq.setMainUIInlineStyle) {
      logseq.setMainUIInlineStyle({
        height: collapsed ? COLLAPSED_HEIGHT : EXPANDED_HEIGHT,
      });
    }
  }, [collapsed]);

  // Don't show the bar if there are no tasks in either view
  if (!nowLoading && !waitingLoading && nowTasks.length === 0 && waitingTasks.length === 0) {
    return null;
  }

  return (
    <div className="power-of-now-bar">
      <div className="bar-header">
        <div className="view-toggle">
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
        </div>
        <span className="bar-toggle" onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? "▲" : "▼"}
        </span>
      </div>

      {!collapsed && (
        <div className="bar-content">
          {loading && <div className="bar-loading">Loading...</div>}
          {!loading && tasks.length > 0 && (
            <div className="task-list">
              {viewMode === "NOW"
                ? nowTasks.map((task) => (
                    <NowTaskItem key={task.uuid} task={task} />
                  ))
                : waitingTasks.map((task) => (
                    <WaitingTaskItem key={task.uuid} task={task} />
                  ))}
            </div>
          )}
          {!loading && tasks.length === 0 && (
            <div className="bar-empty">No {viewMode.toLowerCase()} tasks</div>
          )}
        </div>
      )}
    </div>
  );
};

export default App;
