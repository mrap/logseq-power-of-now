import { useState, useEffect } from "react";
import { NowTask } from "../hooks/useNowTasks";
import { getElapsedTimeFromContent } from "../utils/timeTracking";
import { formatElapsedTime } from "../utils/formatElapsedTime";
import { TaskItem } from "./TaskItem";

interface NowTaskItemProps {
  task: NowTask;
}

export function NowTaskItem({ task }: NowTaskItemProps) {
  const [elapsedTime, setElapsedTime] = useState(() => {
    const elapsed = getElapsedTimeFromContent(task.content);
    return elapsed > 0 ? formatElapsedTime(elapsed) : "--";
  });

  // Update elapsed time every minute
  useEffect(() => {
    const updateTime = () => {
      const elapsed = getElapsedTimeFromContent(task.content);
      setElapsedTime(elapsed > 0 ? formatElapsedTime(elapsed) : "--");
    };

    const intervalId = setInterval(updateTime, 60000);
    return () => clearInterval(intervalId);
  }, [task.content]);

  return (
    <TaskItem
      uuid={task.uuid}
      content={task.content}
      pageId={task.pageId}
      canComplete={true}
      leftSlot={<span className="task-time">{elapsedTime}</span>}
      className="now-task"
    />
  );
}
