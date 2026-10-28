export type ExerciseId = 'pull-up' | 'chin-up' | 'dip' | 'push-up' | 'diamond-push-up' | 'muscle-up' | 'straight-bar-dip' | 'explosive-pull-up'
export type SessionKind = 'strength' | 'emom' | 'circuit' | 'test'
export interface Exercise { id: ExerciseId; name: string; category: 'pull' | 'push' | 'skill'; unit: 'reps' }
export interface SetLog { id: string; exerciseId: ExerciseId; variation: string; addedLoadKg: number; targetReps: number; actualReps: number; rir: number | null; completed: boolean; technique: 'good' | 'degraded' | 'pain'; notes: string; createdAt: number }
export interface EmomMinute { minute: number; targetReps: number; actualReps: number; skipped: boolean; completed: boolean }
export interface EmomLog { id: string; exerciseId: ExerciseId; variation: string; durationMinutes: number; repsPerMinute: number; addedLoadKg: number; minutes: EmomMinute[]; startedAt: number; endedAt: number | null; pausedAt: number | null; accumulatedPauseMs: number; rir: number | null; technique: 'good' | 'degraded' | 'pain'; notes: string }
export interface WorkoutLog { id: string; date: string; dayLabel: string; kind: SessionKind; title: string; setLogs: SetLog[]; emomLogs: EmomLog[]; fatigue: number | null; sleepHours: number | null; pain: string; notes: string; completedAt: number | null }
export interface PersonalRecord { id: string; exerciseId: ExerciseId; reps: number; testedAt: number; notes: string }
export interface ProgressionSuggestion { action: 'increase-reps' | 'maintain' | 'reduce-reps' | 'consider-load'; title: string; reason: string; nextRepsPerMinute?: number; nextLoadKg?: number }
