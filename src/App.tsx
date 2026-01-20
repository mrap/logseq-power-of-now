import { useState, useEffect } from "react";
import { useNowTasks } from "./hooks/useNowTasks";
import { useWaitingTasks } from "./hooks/useWaitingTasks";
import { useTodayTasks } from "./hooks/useTodayTasks";
import { NowTaskItem } from "./components/NowTaskItem";
import { WaitingTaskItem } from "./components/WaitingTaskItem";
import { TodayTaskItem } from "./components/TodayTaskItem";
import "./App.css";

type ViewMode = "NOW" | "WAITING" | "TODAY";

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
  const [collapsed, setCollapsed] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("TODAY");

  const todayTaskCount =
    todayNowTasks.length + todoLaterTasks.length + todayWaitingTasks.length;

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
    nowTasks.length === 0 &&
    waitingTasks.length === 0 &&
    todayTaskCount === 0
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
        </div>
      )}
    </div>
  );
};

export default App;
