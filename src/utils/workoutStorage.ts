import { FinanceData, WorkoutWeek } from "../types";
import { getCurrentWeekStart } from "../data/starterWorkout";

export const prunePastWorkoutDescriptions = (
  data: FinanceData,
  currentWeekStart = getCurrentWeekStart(),
): { data: FinanceData; changed: boolean } => {
  if (!data.workoutWeeks?.length) return { data, changed: false };

  let changed = false;
  const workoutWeeks: WorkoutWeek[] = data.workoutWeeks.map(week => {
    if (week.startDate >= currentWeekStart) return week;

    let weekChanged = false;
    const days = week.days.map(day => {
      let dayChanged = false;
      const exercises = day.exercises.map(exercise => {
        if (!exercise.setup && !exercise.technique && !exercise.important) return exercise;
        dayChanged = true;
        weekChanged = true;
        changed = true;
        return {
          ...exercise,
          setup: "",
          technique: "",
          important: undefined,
        };
      });
      return dayChanged ? { ...day, exercises } : day;
    });
    return weekChanged ? { ...week, days } : week;
  });

  return changed ? { data: { ...data, workoutWeeks }, changed } : { data, changed };
};
