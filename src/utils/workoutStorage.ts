import { FinanceData, WorkoutWeek } from "../types";
import { buildStarterWorkoutWeek, getCurrentWeekStart } from "../data/starterWorkout";

export const prunePastWorkoutDescriptions = (
  data: FinanceData,
  currentWeekStart = getCurrentWeekStart(),
): { data: FinanceData; changed: boolean } => {
  if (!data.workoutWeeks?.length) return { data, changed: false };

  const starterExercises = new Map(
    buildStarterWorkoutWeek(currentWeekStart).days
      .flatMap(day => day.exercises)
      .map(exercise => [exercise.title.trim().toLocaleLowerCase(), exercise]),
  );
  let changed = false;
  const workoutWeeks: WorkoutWeek[] = data.workoutWeeks.map(week => {
    const isPast = week.startDate < currentWeekStart;
    let weekChanged = false;
    const days = week.days.map(day => {
      let dayChanged = false;
      const exercises = day.exercises.map(exercise => {
        const starter = starterExercises.get(exercise.title.trim().toLocaleLowerCase());
        const sets = exercise.sets ?? starter?.sets;
        const reps = exercise.reps ?? starter?.reps;
        const prescriptionChanged = sets !== exercise.sets || reps !== exercise.reps;
        const shouldPruneDescription = isPast && Boolean(exercise.setup || exercise.technique || exercise.important);
        if (!prescriptionChanged && !shouldPruneDescription) return exercise;
        dayChanged = true;
        weekChanged = true;
        changed = true;
        return {
          ...exercise,
          sets,
          reps,
          setup: isPast ? "" : exercise.setup,
          technique: isPast ? "" : exercise.technique,
          important: isPast ? undefined : exercise.important,
        };
      });
      return dayChanged ? { ...day, exercises } : day;
    });
    return weekChanged ? { ...week, days } : week;
  });

  return changed ? { data: { ...data, workoutWeeks }, changed } : { data, changed };
};
