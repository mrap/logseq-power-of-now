import { useState, useEffect } from "react";
import { useNowTasks } from "./hooks/useNowTasks";
import { NowTaskItem } from "./components/NowTaskItem";
import "./App.css";

const COLLAPSED_HEIGHT = "32px";
const EXPANDED_HEIGHT = "250px";

const App = () => {
  const { tasks, loading } = useNowTasks();
  const [collapsed, setCollapsed] = useState(false);

  // Dynamically resize the iframe based on collapsed state
  useEffect(() => {
    if (typeof logseq !== "undefined" && logseq.setMainUIInlineStyle) {
      logseq.setMainUIInlineStyle({
        height: collapsed ? COLLAPSED_HEIGHT : EXPANDED_HEIGHT,
      });
    }
  }, [collapsed]);

  // Don't show the bar if there are no tasks
  if (!loading && tasks.length === 0) {
    return null;
  }

  return (
    <div className="power-of-now-bar">
      <div className="bar-header" onClick={() => setCollapsed(!collapsed)}>
        <span className="bar-title">NOW</span>
        <span className="bar-count">{loading ? "..." : tasks.length}</span>
        <span className="bar-toggle">{collapsed ? "▲" : "▼"}</span>
      </div>

      {!collapsed && (
        <div className="bar-content">
          {loading && <div className="bar-loading">Loading...</div>}
          {!loading && tasks.length > 0 && (
            <div className="task-list">
              {tasks.map((task) => (
                <NowTaskItem key={task.uuid} task={task} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default App;
