import { useEffect, useMemo, useRef, useState } from "react";
import { dbGet, dbSet } from "../lib/db";
import { STORAGE_KEYS } from "../lib/constants";
import { createId } from "../lib/helpers";
import {
  DEFAULT_CHECKLIST,
  getTaskCompletionSummary,
  normalizeChecklistData,
  partitionTasks,
} from "../lib/checklist";
import SaveCancelModal from "../components/SaveCancelModal";
import EditToggleButton from "../components/EditToggleButton";
import { syncMileageIfHigher } from "../lib/mileage";

function createEmptyTaskEditor() {
  return {
    id: null,
    taskName: "",
    subtasks: [{ id: createId("subtask"), name: "" }],
  };
}

function mapTaskToEditor(task) {
  return {
    id: task.id,
    taskName: task.taskName || "",
    subtasks: (task.subtasks || []).map((subtask) => ({
      id: subtask.id,
      name: subtask.name || "",
    })),
  };
}

function Checklist() {
  const pressTimer = useRef(null);
  const subtaskPressTimer = useRef(null);
  const [checklist, setChecklist] = useState(DEFAULT_CHECKLIST);
  const [activeTab, setActiveTab] = useState("todo");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  const [taskEditorOpen, setTaskEditorOpen] = useState(false);
  const [taskEditor, setTaskEditor] = useState(createEmptyTaskEditor);
  const [taskEditorError, setTaskEditorError] = useState("");
  const [subtaskMetaTarget, setSubtaskMetaTarget] = useState(null);
  const [subtaskMetaForm, setSubtaskMetaForm] = useState({
    name: "",
    date: "",
    kilometers: "",
  });
  const [subtaskMetaError, setSubtaskMetaError] = useState("");

  useEffect(() => {
    let mounted = true;
    dbGet(STORAGE_KEYS.checklistData, DEFAULT_CHECKLIST).then((data) => {
      if (!mounted) {
        return;
      }
      const normalized = normalizeChecklistData(data);
      setChecklist(normalized);
      const changed = JSON.stringify(data) !== JSON.stringify(normalized);
      if (changed) {
        dbSet(STORAGE_KEYS.checklistData, normalized);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const persistTasks = async (tasks) => {
    const next = partitionTasks(tasks);
    setChecklist(next);
    await dbSet(STORAGE_KEYS.checklistData, next);
  };

  const clearTimer = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const clearSubtaskTimer = () => {
    if (subtaskPressTimer.current) {
      clearTimeout(subtaskPressTimer.current);
      subtaskPressTimer.current = null;
    }
  };

  const handleLongPressStart = (task) => {
    if (selectMode) {
      return;
    }
    clearTimer();
    pressTimer.current = setTimeout(() => {
      openTaskEditorForEdit(task);
    }, 550);
  };

  const deleteTask = async (id) => {
    await persistTasks([
      ...checklist.todo.filter((task) => task.id !== id),
      ...checklist.done.filter((task) => task.id !== id),
    ]);
  };

  const toggleSelect = (id) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  const deleteSelected = async () => {
    if (!selectedIds.length) {
      return;
    }
    await persistTasks([
      ...checklist.todo.filter((task) => !selectedIds.includes(task.id)),
      ...checklist.done,
    ]);
    setSelectedIds([]);
    setSelectMode(false);
  };

  const openTaskEditorForNew = () => {
    setTaskEditor(createEmptyTaskEditor());
    setTaskEditorError("");
    setTaskEditorOpen(true);
  };

  const openTaskEditorForEdit = (task) => {
    setTaskEditor(mapTaskToEditor(task));
    setTaskEditorError("");
    setTaskEditorOpen(true);
  };

  const closeTaskEditor = () => {
    setTaskEditorOpen(false);
    setTaskEditor(createEmptyTaskEditor());
    setTaskEditorError("");
  };

  const deleteTaskFromEditor = async () => {
    if (!taskEditor.id) {
      return;
    }
    await deleteTask(taskEditor.id);
    closeTaskEditor();
  };

  const addSubtask = () => {
    setTaskEditor((current) => ({
      ...current,
      subtasks: [...current.subtasks, { id: createId("subtask"), name: "" }],
    }));
  };

  const removeSubtask = (subtaskId) => {
    setTaskEditor((current) => {
      if (current.subtasks.length === 1) {
        return current;
      }
      return {
        ...current,
        subtasks: current.subtasks.filter((subtask) => subtask.id !== subtaskId),
      };
    });
  };

  const updateSubtaskName = (subtaskId, value) => {
    setTaskEditor((current) => ({
      ...current,
      subtasks: current.subtasks.map((subtask) =>
        subtask.id === subtaskId ? { ...subtask, name: value } : subtask
      ),
    }));
  };

  const saveTaskEditor = async () => {
    const taskName = taskEditor.taskName.trim();
    const cleanedSubtasks = taskEditor.subtasks
      .map((subtask) => ({ ...subtask, name: subtask.name.trim() }))
      .filter((subtask) => subtask.name);

    if (!taskName) {
      setTaskEditorError("Task name is required.");
      return;
    }

    if (cleanedSubtasks.length === 0) {
      setTaskEditorError("Add at least one subtask.");
      return;
    }

    const existingTask = checklist.todo.find((task) => task.id === taskEditor.id);
    const existingSubtaskMap = new Map(
      (existingTask?.subtasks || []).map((subtask) => [subtask.id, subtask])
    );

    const normalizedSubtasks = cleanedSubtasks.map((subtask) => {
      const previous = existingSubtaskMap.get(subtask.id);
      if (previous) {
        return {
          ...previous,
          name: subtask.name,
        };
      }
      return {
        id: subtask.id,
        name: subtask.name,
        isDone: false,
        completedDate: "",
        completedKilometers: "",
      };
    });

    const nextTask = {
      id: taskEditor.id || createId("task"),
      taskName,
      subtasks: normalizedSubtasks,
    };

    const nextTasks = taskEditor.id
      ? [
          ...checklist.todo.map((task) => (task.id === taskEditor.id ? nextTask : task)),
          ...checklist.done,
        ]
      : [...checklist.todo, nextTask, ...checklist.done];

    await persistTasks(nextTasks);
    closeTaskEditor();
  };

  const updateSubtask = async (taskId, subtaskId, updater) => {
    const allTasks = [...checklist.todo, ...checklist.done].map((task) => {
      if (task.id !== taskId) {
        return task;
      }
      return {
        ...task,
        subtasks: task.subtasks.map((subtask) => {
          if (subtask.id !== subtaskId) {
            return subtask;
          }
          return updater(subtask);
        }),
      };
    });
    await persistTasks(allTasks);
  };

  const markSubtaskDone = async (taskId, subtaskId) => {
    await updateSubtask(taskId, subtaskId, (subtask) => ({
      ...subtask,
      isDone: true,
    }));
  };

  const unmarkSubtask = async (taskId, subtaskId) => {
    await updateSubtask(taskId, subtaskId, (subtask) => ({
      ...subtask,
      isDone: false,
      completedDate: "",
      completedKilometers: "",
    }));
  };

  const updateSubtaskMetadata = async (taskId, subtaskId, patch) => {
    await updateSubtask(taskId, subtaskId, (subtask) => ({
      ...subtask,
      ...patch,
    }));
  };

  const handleSubtaskLongPressStart = (event, taskId, subtask) => {
    if (!subtask.isDone) {
      return;
    }
    event.stopPropagation();
    clearSubtaskTimer();
    subtaskPressTimer.current = setTimeout(() => {
      setSubtaskMetaTarget({ taskId, subtaskId: subtask.id });
      setSubtaskMetaForm({
        name: subtask.name || "",
        date: subtask.completedDate || "",
        kilometers: subtask.completedKilometers || "",
      });
      setSubtaskMetaError("");
    }, 550);
  };

  const closeSubtaskMetaModal = () => {
    setSubtaskMetaTarget(null);
    setSubtaskMetaForm({ name: "", date: "", kilometers: "" });
    setSubtaskMetaError("");
  };

  const saveSubtaskMeta = async () => {
    if (!subtaskMetaTarget) {
      return;
    }

    const trimmedName = subtaskMetaForm.name.trim();
    if (!trimmedName) {
      setSubtaskMetaError("Subtask name is required.");
      return;
    }

    await updateSubtaskMetadata(subtaskMetaTarget.taskId, subtaskMetaTarget.subtaskId, {
      name: trimmedName,
      completedDate: subtaskMetaForm.date,
      completedKilometers: subtaskMetaForm.kilometers,
    });
    await syncMileageIfHigher(subtaskMetaForm.kilometers);
    closeSubtaskMetaModal();
  };

  const sortedDone = useMemo(() => {
    return [...checklist.done].sort((a, b) => {
      const summaryA = getTaskCompletionSummary(a);
      const summaryB = getTaskCompletionSummary(b);
      return (summaryB.date || "").localeCompare(summaryA.date || "");
    });
  }, [checklist.done]);

  return (
    <main className="page">
      <h2 className="page-title">Checklist</h2>

      <div className="tabs">
        <button
          type="button"
          className={activeTab === "todo" ? "tab-active" : ""}
          onClick={() => setActiveTab("todo")}
        >
          To-Do
        </button>
        <button
          type="button"
          className={activeTab === "done" ? "tab-active" : ""}
          onClick={() => setActiveTab("done")}
        >
          Done
        </button>
      </div>

      {activeTab === "todo" && (
        <section className="list" style={{ marginTop: 12 }}>
          {checklist.todo.length === 0 && (
            <article className="card">
              <p className="muted">No tasks in To-Do.</p>
            </article>
          )}
          {checklist.todo.map((task) => {
            const doneCount = task.subtasks.filter((subtask) => subtask.isDone).length;
            return (
              <article
                key={task.id}
                className="card"
                onPointerDown={() => handleLongPressStart(task)}
                onPointerUp={clearTimer}
                onPointerLeave={clearTimer}
              >
                {selectMode && (
                  <label className="item-row" style={{ display: "flex", gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(task.id)}
                      onChange={() => toggleSelect(task.id)}
                    />
                    Select
                  </label>
                )}
                <h3 className="item-title">{task.taskName}</h3>
                <p className="item-row">
                  Progress: {doneCount}/{task.subtasks.length} subtasks done
                </p>
                {task.subtasks.map((subtask) => (
                  <div
                    key={subtask.id}
                    className="card"
                    style={{ marginTop: 8 }}
                    onPointerDown={(event) =>
                      handleSubtaskLongPressStart(event, task.id, subtask)
                    }
                    onPointerUp={clearSubtaskTimer}
                    onPointerLeave={clearSubtaskTimer}
                  >
                    <label className="checklist-subtask-check">
                      <input
                        type="checkbox"
                        checked={subtask.isDone}
                        onChange={(event) => {
                          if (event.target.checked && !subtask.isDone) {
                            markSubtaskDone(task.id, subtask.id);
                          } else if (!event.target.checked && subtask.isDone) {
                            unmarkSubtask(task.id, subtask.id);
                          }
                        }}
                      />
                      <span
                        className={
                          subtask.isDone ? "checklist-subtask-done" : undefined
                        }
                      >
                        {subtask.name}
                      </span>
                      
                    </label>
                    {subtask.isDone && (
                      <>
                        {subtask.completedDate && (
                          <p className="item-row">Date: {subtask.completedDate}</p>
                        )}
                        {subtask.completedKilometers && (
                          <p className="item-row">
                            Kilometers: {subtask.completedKilometers}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </article>
            );
          })}
        </section>
      )}

      {activeTab === "done" && (
        <section className="list" style={{ marginTop: 12 }}>
          {sortedDone.length === 0 && (
            <article className="card">
              <p className="muted">No completed tasks yet.</p>
            </article>
          )}
          {sortedDone.map((task) => {
            const summary = getTaskCompletionSummary(task);
            return (
              <article className="card" key={task.id}>
                <h3 className="item-title">
                  {task.taskName} <span className="chip">Done</span>
                </h3>
                <p className="item-row">Date: {summary.date || "N/A"}</p>
                <p className="item-row">
                  Kilometers: {summary.kilometers || "N/A"}
                </p>
                {task.subtasks.map((subtask) => (
                  <div
                    key={subtask.id}
                    className="card"
                    style={{ marginTop: 8 }}
                    onPointerDown={(event) =>
                      handleSubtaskLongPressStart(event, task.id, subtask)
                    }
                    onPointerUp={clearSubtaskTimer}
                    onPointerLeave={clearSubtaskTimer}
                  >
                    <label className="checklist-subtask-check checklist-subtask-done-row">
                      <input
                        type="checkbox"
                        checked={subtask.isDone}
                        onChange={(event) => {
                          if (!event.target.checked && subtask.isDone) {
                            unmarkSubtask(task.id, subtask.id);
                          }
                        }}
                      />
                    <span className="item-row checklist-subtask-done">
                      {subtask.name}
                    </span>
                    </label>
                    {subtask.completedDate && (
                      <p className="item-row">Date: {subtask.completedDate}</p>
                    )}
                    {subtask.completedKilometers && (
                      <p className="item-row">
                        Kilometers: {subtask.completedKilometers}
                      </p>
                    )}
                  </div>
                ))}
              </article>
            );
          })}
        </section>
      )}

      {selectMode && activeTab === "todo" && (
        <button
          type="button"
          className="btn-danger"
          style={{ marginTop: 12 }}
          onClick={deleteSelected}
        >
          Delete Selected
        </button>
      )}

      {activeTab === "todo" && (
        <>
          <button
            type="button"
            className="fab"
            onClick={openTaskEditorForNew}
            aria-label="Add task"
          >
            +
          </button>
          <EditToggleButton
            active={selectMode}
            onClick={() => {
              setSelectMode(!selectMode);
              setSelectedIds([]);
            }}
            className="fab fab-left"
          />
        </>
      )}

      <SaveCancelModal
        open={taskEditorOpen}
        title={taskEditor.id ? "Edit Task" : "Add Task"}
        onSave={saveTaskEditor}
        onCancel={closeTaskEditor}
      >
        <section className="field-grid">
          <div>
            <label className="label" htmlFor="task-name-input">
              Task name
            </label>
            <input
              id="task-name-input"
              className="input"
              value={taskEditor.taskName}
              onChange={(event) =>
                setTaskEditor((current) => ({
                  ...current,
                  taskName: event.target.value,
                }))
              }
            />
          </div>
          <div>
            <label className="label">Subtasks</label>
            <div className="field-grid">
              {taskEditor.subtasks.map((subtask, index) => (
                <div key={subtask.id} className="checklist-subtask-row">
                  <input
                    className="input"
                    placeholder={`Subtask ${index + 1}`}
                    value={subtask.name}
                    onChange={(event) =>
                      updateSubtaskName(subtask.id, event.target.value)
                    }
                  />
                  <button
                    type="button"
                    onClick={() => removeSubtask(subtask.id)}
                    disabled={taskEditor.subtasks.length === 1}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <button type="button" style={{ marginTop: 8 }} onClick={addSubtask}>
              Add Subtask
            </button>
          </div>
          {taskEditor.id && (
            <button
              type="button"
              className="btn-danger"
              onClick={deleteTaskFromEditor}
            >
              Delete Task
            </button>
          )}
          {taskEditorError && <p className="warning">{taskEditorError}</p>}
        </section>
      </SaveCancelModal>

      <SaveCancelModal
        open={Boolean(subtaskMetaTarget)}
        title="Edit Subtask Details"
        onSave={saveSubtaskMeta}
        onCancel={closeSubtaskMetaModal}
      >
        <section className="field-grid">
          <div>
            <label className="label" htmlFor="subtask-meta-name">
              Subtask name
            </label>
            <input
              id="subtask-meta-name"
              className="input"
              value={subtaskMetaForm.name}
              onChange={(event) =>
                setSubtaskMetaForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
            />
          </div>
          <div>
            <label className="label" htmlFor="subtask-meta-date">
              Date (optional)
            </label>
            <input
              id="subtask-meta-date"
              type="date"
              className="input"
              value={subtaskMetaForm.date}
              onChange={(event) =>
                setSubtaskMetaForm((current) => ({
                  ...current,
                  date: event.target.value,
                }))
              }
            />
          </div>
          <div>
            <label className="label" htmlFor="subtask-meta-km">
              Kilometers (optional)
            </label>
            <input
              id="subtask-meta-km"
              className="input"
              inputMode="numeric"
              value={subtaskMetaForm.kilometers}
              onChange={(event) =>
                setSubtaskMetaForm((current) => ({
                  ...current,
                  kilometers: event.target.value,
                }))
              }
            />
          </div>
          {subtaskMetaError && <p className="warning">{subtaskMetaError}</p>}
        </section>
      </SaveCancelModal>
    </main>
  );
}

export default Checklist;

