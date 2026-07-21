import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Dumbbell,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { WorkoutDay, WorkoutExercise, WorkoutWeek } from "../types";
import { buildStarterWorkoutWeek, cloneWorkoutWeek, formatWorkoutWeek, getCurrentWeekStart } from "../data/starterWorkout";

interface WorkoutViewProps {
  weeks: WorkoutWeek[];
  onChange: (weeks: WorkoutWeek[]) => void;
  triggerConfirm: (title: string, message: string, onConfirm: () => void) => void;
  triggerAlert: (title: string, message: string) => void;
}

interface ExerciseDraft {
  dayId: string;
  id?: string;
  title: string;
  muscleGroup: string;
  setup: string;
  technique: string;
  important: string;
}

const addDays = (dateString: string, days: number) => {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12);
  date.setDate(date.getDate() + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const weekProgress = (week: WorkoutWeek) => {
  const exercises = week.days.flatMap(day => day.exercises);
  const completed = exercises.filter(exercise => exercise.completed).length;
  return { completed, total: exercises.length, percent: exercises.length ? Math.round((completed / exercises.length) * 100) : 0 };
};

const emptyDraft = (dayId: string): ExerciseDraft => ({
  dayId,
  title: "",
  muscleGroup: "",
  setup: "",
  technique: "",
  important: "",
});

export const WorkoutView: React.FC<WorkoutViewProps> = ({ weeks, onChange, triggerConfirm, triggerAlert }) => {
  const [selectedWeekId, setSelectedWeekId] = useState<string | null>(null);
  const [expandedDayId, setExpandedDayId] = useState<string | null>(null);
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ExerciseDraft | null>(null);

  const sortedWeeks = useMemo(
    () => [...weeks].sort((a, b) => b.startDate.localeCompare(a.startDate)),
    [weeks],
  );
  const selectedWeek = weeks.find(week => week.id === selectedWeekId) ?? null;
  const currentWeekStart = getCurrentWeekStart();

  useEffect(() => {
    if (selectedWeekId && !weeks.some(week => week.id === selectedWeekId)) setSelectedWeekId(null);
  }, [selectedWeekId, weeks]);

  useEffect(() => {
    if (!draft) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDraft(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [draft]);

  const openWeek = (week: WorkoutWeek) => {
    const today = new Date().toLocaleDateString("en-US", { weekday: "long" });
    const firstDay = week.days.find(day => day.name === today) ?? week.days[0];
    setSelectedWeekId(week.id);
    setExpandedDayId(firstDay?.id ?? null);
    setExpandedExerciseId(null);
  };

  const addWeek = () => {
    if (!sortedWeeks.length) {
      const week = buildStarterWorkoutWeek();
      onChange([week]);
      openWeek(week);
      return;
    }
    const latest = sortedWeeks[0];
    const nextStart = addDays(latest.startDate, 7);
    const week = cloneWorkoutWeek(latest, nextStart);
    onChange([...weeks, week]);
    openWeek(week);
  };

  const updateSelectedWeek = (updater: (week: WorkoutWeek) => WorkoutWeek) => {
    if (!selectedWeek) return;
    onChange(weeks.map(week => week.id === selectedWeek.id ? updater(week) : week));
  };

  const toggleExercise = (dayId: string, exerciseId: string) => {
    updateSelectedWeek(week => ({
      ...week,
      days: week.days.map(day => day.id === dayId ? {
        ...day,
        exercises: day.exercises.map(exercise => exercise.id === exerciseId
          ? { ...exercise, completed: !exercise.completed }
          : exercise),
      } : day),
    }));
  };

  const openEditor = (day: WorkoutDay, exercise?: WorkoutExercise) => {
    setDraft(exercise ? {
      dayId: day.id,
      id: exercise.id,
      title: exercise.title,
      muscleGroup: exercise.muscleGroup,
      setup: exercise.setup,
      technique: exercise.technique,
      important: exercise.important ?? "",
    } : emptyDraft(day.id));
  };

  const saveExercise = (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft || !selectedWeek) return;
    const title = draft.title.trim();
    if (!title) {
      triggerAlert("Exercise name", "Enter an exercise name.");
      return;
    }

    const existing = selectedWeek.days.flatMap(day => day.exercises).find(exercise => exercise.id === draft.id);
    const exercise: WorkoutExercise = {
      id: draft.id ?? crypto.randomUUID(),
      title,
      muscleGroup: draft.muscleGroup.trim(),
      setup: draft.setup.trim(),
      technique: draft.technique.trim(),
      important: draft.important.trim() || undefined,
      completed: existing?.completed ?? false,
    };

    updateSelectedWeek(week => ({
      ...week,
      days: week.days.map(day => {
        const withoutEdited = day.exercises.filter(item => item.id !== draft.id);
        return day.id === draft.dayId ? { ...day, exercises: [...withoutEdited, exercise] } : { ...day, exercises: withoutEdited };
      }),
    }));
    setDraft(null);
  };

  const removeExercise = (dayId: string, exercise: WorkoutExercise) => {
    triggerConfirm("Delete exercise", `Delete “${exercise.title}”?`, () => {
      updateSelectedWeek(week => ({
        ...week,
        days: week.days.map(day => day.id === dayId
          ? { ...day, exercises: day.exercises.filter(item => item.id !== exercise.id) }
          : day),
      }));
      if (expandedExerciseId === exercise.id) setExpandedExerciseId(null);
    });
  };

  if (!selectedWeek) {
    return (
      <section className="workout-view mx-auto max-w-3xl space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Workouts</h2>
            <p className="mt-1 text-[11px] text-white/40">Weekly home training</p>
          </div>
          <button onClick={addWeek} className="figma-soft-button flex h-[38px] items-center gap-1.5 px-3.5 text-[12px] font-semibold text-white">
            <Plus size={15} /> Add week
          </button>
        </div>

        <div className="space-y-2.5">
          {sortedWeeks.map(week => {
            const progress = weekProgress(week);
            const isCurrent = week.startDate === currentWeekStart;
            return (
              <article key={week.id} className={`workout-week-card figma-surface rounded-[30px] p-4 ${isCurrent ? "is-current" : ""}`}>
                <div className="flex items-center gap-3">
                  <button onClick={() => openWeek(week)} className="min-w-0 flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-[15px] font-semibold text-white">{week.title || formatWorkoutWeek(week.startDate)}</h3>
                      {isCurrent && <span className="rounded-full bg-[#29ff5e]/10 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#29ff5e]">Current</span>}
                    </div>
                    <p className="mt-1 text-[11px] text-white/38">{week.days.length} days · {progress.completed} of {progress.total} completed</p>
                  </button>
                  <div className="workout-progress-ring" style={{ "--progress": `${progress.percent * 3.6}deg` } as React.CSSProperties}>
                    <span>{progress.percent}%</span>
                  </div>
                  <button onClick={() => openWeek(week)} className="figma-icon-button text-white/55" aria-label={`Open ${week.title}`}>
                    <ChevronRight size={17} />
                  </button>
                </div>
                <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.07]">
                  <div className="h-full rounded-full bg-[#29ff5e] transition-all duration-300" style={{ width: `${progress.percent}%` }} />
                </div>
              </article>
            );
          })}
        </div>
      </section>
    );
  }

  const progress = weekProgress(selectedWeek);

  return (
    <section className="workout-view mx-auto max-w-3xl space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => setSelectedWeekId(null)} className="figma-icon-button text-white/70" aria-label="Back to weeks">
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold text-white">{selectedWeek.title}</h2>
          <p className="mt-0.5 text-[11px] text-white/40">{progress.completed} of {progress.total} completed</p>
        </div>
        <button
          onClick={() => triggerConfirm("Delete week", `Delete ${selectedWeek.title}?`, () => onChange(weeks.filter(week => week.id !== selectedWeek.id)))}
          className="figma-icon-button text-[#ff5050]"
          aria-label="Delete week"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div className="figma-surface rounded-[30px] p-4">
        <div className="flex items-center gap-4">
          <div className="workout-progress-ring is-large" style={{ "--progress": `${progress.percent * 3.6}deg` } as React.CSSProperties}>
            <span>{progress.percent}%</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3 text-[11px]">
              <span className="font-semibold text-white">Weekly progress</span>
              <span className="text-white/40">{progress.total - progress.completed} left</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
              <div className="h-full rounded-full bg-[#29ff5e] transition-all duration-300" style={{ width: `${progress.percent}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2.5">
        {selectedWeek.days.map(day => {
          const isExpanded = expandedDayId === day.id;
          const completed = day.exercises.filter(exercise => exercise.completed).length;
          return (
            <article key={day.id} className="workout-day-card figma-surface overflow-hidden rounded-[30px]">
              <button
                onClick={() => setExpandedDayId(isExpanded ? null : day.id)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
                aria-expanded={isExpanded}
              >
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${completed === day.exercises.length && day.exercises.length ? "border-[#29ff5e]/30 bg-[#29ff5e]/10 text-[#29ff5e]" : "border-white/[0.14] bg-white/[0.04] text-white/55"}`}>
                  {completed === day.exercises.length && day.exercises.length ? <Check size={16} /> : <Dumbbell size={15} />}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[14px] font-semibold text-white">{day.name}</h3>
                  <p className="truncate text-[10px] text-white/38">{day.focus}</p>
                </div>
                <span className="text-[11px] tabular-nums text-white/38">{completed}/{day.exercises.length}</span>
                <ChevronDown size={17} className={`text-white/55 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
              </button>

              {isExpanded && (
                <div className="border-t border-white/[0.08] px-2.5 pb-2.5 pt-2.5">
                  <div className="space-y-2">
                    {day.exercises.map(exercise => {
                      const detailsOpen = expandedExerciseId === exercise.id;
                      return (
                        <div key={exercise.id} className={`workout-exercise rounded-[24px] border px-3 py-2.5 ${exercise.completed ? "is-completed border-[#29ff5e]/20 bg-[#29ff5e]/[0.055]" : "border-white/[0.1] bg-white/[0.025]"}`}>
                          <div className="flex items-center gap-2.5">
                            <button
                              onClick={() => toggleExercise(day.id, exercise.id)}
                              className={`workout-check flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border ${exercise.completed ? "border-[#29ff5e]/40 bg-[#29ff5e] text-[#07120a]" : "border-white/[0.18] bg-white/[0.04] text-transparent"}`}
                              aria-label={exercise.completed ? `Mark ${exercise.title} incomplete` : `Mark ${exercise.title} complete`}
                            >
                              <Check size={17} strokeWidth={2.5} />
                            </button>
                            <button onClick={() => setExpandedExerciseId(detailsOpen ? null : exercise.id)} className="min-w-0 flex-1 text-left">
                              <h4 className={`text-[13px] font-semibold leading-5 ${exercise.completed ? "text-white/45 line-through" : "text-white"}`}>{exercise.title}</h4>
                              <p className="truncate text-[10px] text-white/35">{exercise.muscleGroup || "Exercise"}</p>
                            </button>
                            <button onClick={() => openEditor(day, exercise)} className="figma-icon-button text-white/50" aria-label={`Edit ${exercise.title}`}>
                              <Pencil size={15} />
                            </button>
                          </div>

                          {detailsOpen && (
                            <div className="mt-3 space-y-3 border-t border-white/[0.07] pb-1 pt-3 text-[11px] leading-[1.65] text-white/55">
                              {exercise.setup && <div><p className="mb-1 font-semibold text-white/85">Start position</p><p>{exercise.setup}</p></div>}
                              {exercise.technique && <div><p className="mb-1 font-semibold text-white/85">Technique</p><p>{exercise.technique}</p></div>}
                              {exercise.important && <div className="rounded-[18px] border border-amber-300/15 bg-amber-300/[0.055] px-3 py-2.5 text-amber-100/65"><span className="font-semibold text-amber-100/90">Important: </span>{exercise.important}</div>}
                              <button onClick={() => removeExercise(day.id, exercise)} className="flex h-[38px] items-center gap-1.5 px-3 text-[10px] font-semibold text-[#ff6868]">
                                <Trash2 size={13} /> Delete
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <button onClick={() => openEditor(day)} className="figma-soft-button mt-2.5 flex h-[38px] w-full items-center justify-center gap-1.5 text-[11px] font-semibold text-white/65">
                    <Plus size={14} /> Add exercise
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {draft && (
        <div
          className="app-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md animate-fadeIn"
          onMouseDown={event => event.target === event.currentTarget && setDraft(null)}
        >
          <form onSubmit={saveExercise} className="workout-editor liquid-glass-strong max-h-[90vh] w-full max-w-lg overflow-y-auto p-5 shadow-2xl">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-white">{draft.id ? "Edit exercise" : "Add exercise"}</h3>
              <button type="button" onClick={() => setDraft(null)} className="figma-icon-button text-white/50" aria-label="Close"><X size={16} /></button>
            </div>
            <div className="space-y-3.5">
              <label className="block space-y-1.5">
                <span className="pl-3 text-[10px] text-white/40">Day</span>
                <select value={draft.dayId} onChange={event => setDraft({ ...draft, dayId: event.target.value })} className="figma-input min-h-11 w-full rounded-full px-4 text-xs text-white outline-none">
                  {selectedWeek.days.map(day => <option key={day.id} value={day.id}>{day.name}</option>)}
                </select>
              </label>
              <label className="block space-y-1.5">
                <span className="pl-3 text-[10px] text-white/40">Exercise</span>
                <input autoFocus value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} className="figma-input min-h-11 w-full rounded-full px-4 text-xs text-white outline-none" />
              </label>
              <label className="block space-y-1.5">
                <span className="pl-3 text-[10px] text-white/40">Muscle group</span>
                <input value={draft.muscleGroup} onChange={event => setDraft({ ...draft, muscleGroup: event.target.value })} className="figma-input min-h-11 w-full rounded-full px-4 text-xs text-white outline-none" />
              </label>
              {(["setup", "technique", "important"] as const).map(field => (
                <label key={field} className="block space-y-1.5">
                  <span className="pl-3 text-[10px] capitalize text-white/40">{field === "setup" ? "Start position" : field}</span>
                  <textarea
                    rows={field === "technique" ? 4 : 3}
                    value={draft[field]}
                    onChange={event => setDraft({ ...draft, [field]: event.target.value })}
                    className="figma-input w-full resize-none rounded-[22px] px-4 py-3 text-xs leading-relaxed text-white outline-none"
                  />
                </label>
              ))}
            </div>
            <button type="submit" className="figma-soft-button is-primary mt-5 min-h-11 w-full text-[12px] font-semibold text-white">Save exercise</button>
          </form>
        </div>
      )}
    </section>
  );
};
