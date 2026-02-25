import { createId } from "./helpers";

export const DEFAULT_CHECKLIST = {
  todo: [],
  done: [],
};

function normalizeSubtask(subtask, index, forceDone = false) {
  return {
    id: subtask?.id || `subtask-${index}-${Date.now()}`,
    name: subtask?.name || subtask?.subtaskName || "",
    isDone: forceDone || Boolean(subtask?.isDone),
    completedDate: subtask?.completedDate || "",
    completedKilometers: subtask?.completedKilometers || "",
  };
}

function normalizeTask(task, index, forceDone = false) {
  const sourceSubtasks = Array.isArray(task?.subtasks) ? task.subtasks : [];
  const subtasks = sourceSubtasks
    .map((subtask, subtaskIndex) =>
      normalizeSubtask(subtask, subtaskIndex, forceDone)
    )
    .filter((subtask) => subtask.name.trim());

  return {
    id: task?.id || `task-${index}-${Date.now()}`,
    taskName: task?.taskName || "Untitled task",
    subtasks,
  };
}

function fromLegacyDoneEntry(entry, index) {
  return {
    id: entry?.id || `done-${index}-${Date.now()}`,
    taskName: entry?.taskName || "Completed task",
    subtasks: [
      {
        id: createId("subtask"),
        name: "Completed",
        isDone: true,
        completedDate: entry?.date || "",
        completedKilometers: entry?.kilometers || "",
      },
    ],
  };
}

function allSubtasksDone(task) {
  if (!Array.isArray(task.subtasks) || task.subtasks.length === 0) {
    return false;
  }
  return task.subtasks.every((subtask) => subtask.isDone);
}

export function normalizeChecklistData(rawData) {
  const source = rawData && typeof rawData === "object" ? rawData : DEFAULT_CHECKLIST;

  const normalizedTodo = Array.isArray(source.todo)
    ? source.todo
        .map((task, index) => normalizeTask(task, index, false))
        .filter((task) => task.taskName.trim() && task.subtasks.length > 0)
    : [];

  const normalizedDone = Array.isArray(source.done)
    ? source.done
        .map((entry, index) => {
          if (Array.isArray(entry?.subtasks)) {
            return normalizeTask(entry, index, true);
          }
          return fromLegacyDoneEntry(entry, index);
        })
        .filter((task) => task.taskName.trim() && task.subtasks.length > 0)
    : [];

  return partitionTasks([...normalizedTodo, ...normalizedDone]);
}

export function partitionTasks(tasks) {
  const todo = [];
  const done = [];

  tasks.forEach((task, index) => {
    const normalized = normalizeTask(task, index, false);
    if (!normalized.taskName.trim() || normalized.subtasks.length === 0) {
      return;
    }
    if (allSubtasksDone(normalized)) {
      done.push({
        ...normalized,
        subtasks: normalized.subtasks.map((subtask) => ({
          ...subtask,
          isDone: true,
        })),
      });
    } else {
      todo.push(normalized);
    }
  });

  return { todo, done };
}

export function getTaskCompletionSummary(task) {
  const completedSubtasks = (task?.subtasks || []).filter((subtask) => subtask.isDone);
  const lastWithDate = [...completedSubtasks]
    .reverse()
    .find((subtask) => subtask.completedDate);
  const lastWithKm = [...completedSubtasks]
    .reverse()
    .find((subtask) => subtask.completedKilometers);

  return {
    date: lastWithDate?.completedDate || "",
    kilometers: lastWithKm?.completedKilometers || "",
  };
}
