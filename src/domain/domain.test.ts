import { describe, expect, it } from 'vitest'
import { suggestEmomProgression } from './progression'
import { getRecoveryAlerts } from './recovery'
import { parseBackup } from './backup'
import { suggestStrengthProgression } from './strengthProgression'
import { prescriptionForWeek, TRAINING_WEEK } from '../data/program'
import type { EmomLog, WorkoutLog } from '../types'

function emom(overrides: Partial<EmomLog> = {}): EmomLog {
  const durationMinutes = overrides.durationMinutes ?? 3
  const repsPerMinute = overrides.repsPerMinute ?? 6
  return {
    id: 'emom-1',
    exerciseId: 'pull-up',
    variation: 'Strict',
    durationMinutes,
    repsPerMinute,
    addedLoadKg: 0,
    minutes: Array.from({ length: durationMinutes }, (_, index) => ({
      minute: index + 1,
      targetReps: repsPerMinute,
      actualReps: repsPerMinute,
      skipped: false,
      completed: true,
    })),
    startedAt: 100,
    endedAt: 200,
    pausedAt: null,
    accumulatedPauseMs: 0,
    rir: 2,
    technique: 'good',
    notes: '',
    ...overrides,
  }
}

function workout(id: string, date: string, reps: number, options: { sleepHours?: number | null; pain?: string; fatigue?: number | null; addedLoadKg?: number } = {}): WorkoutLog {
  return {
    id,
    date,
    dayLabel: 'Lunedì',
    kind: 'strength',
    title: 'Pull-up',
    setLogs: [{
      id: 'set-' + id,
      exerciseId: 'pull-up',
      variation: 'Strict',
      addedLoadKg: options.addedLoadKg ?? 0,
      targetReps: reps,
      actualReps: reps,
      rir: 2,
      completed: true,
      technique: 'good',
      notes: '',
      createdAt: Date.parse(date + 'T18:00:00Z'),
    }],
    emomLogs: [],
    fatigue: options.fatigue ?? null,
    sleepHours: options.sleepHours ?? null,
    pain: options.pain ?? '',
    notes: '',
    completedAt: Date.parse(date + 'T18:00:00Z'),
  }
}

describe('EMOM progression rules', () => {
  it('suggests one extra rep per minute after a complete clean session', () => {
    const suggestion = suggestEmomProgression(emom(), 0)
    expect(suggestion.action).toBe('increase-reps')
    expect(suggestion.nextRepsPerMinute).toBe(7)
  })

  it('does not progress an incomplete or skipped session', () => {
    const log = emom({
      minutes: [
        { minute: 1, targetReps: 6, actualReps: 6, skipped: false, completed: true },
        { minute: 2, targetReps: 6, actualReps: 0, skipped: true, completed: false },
      ],
    })
    const suggestion = suggestEmomProgression(log)
    expect(suggestion.action).toBe('reduce-reps')
    expect(suggestion.nextRepsPerMinute).toBe(5)
  })

  it('blocks load increases if pain is reported', () => {
    const suggestion = suggestEmomProgression(emom({ technique: 'pain' }), 5)
    expect(suggestion.action).toBe('maintain')
    expect(suggestion.nextLoadKg).toBeUndefined()
  })

  it('only evaluates an extra load step after multiple clean sessions', () => {
    const suggestion = suggestEmomProgression(emom(), 3)
    expect(suggestion.action).toBe('consider-load')
    expect(suggestion.nextLoadKg).toBe(5)
    expect(suggestion.nextRepsPerMinute).toBe(4)
  })
})

describe('recovery alerts', () => {
  it('flags two consecutive declines for the same exercise and variation', () => {
    const alerts = getRecoveryAlerts([
      workout('newest', '2026-10-28', 8),
      workout('middle', '2026-10-27', 10),
      workout('oldest', '2026-10-26', 12),
    ])
    expect(alerts.some(alert => alert.id === 'decline')).toBe(true)
  })

  it('flags pain and short sleep without changing any workout data', () => {
    const recent = workout('recent', '2026-10-28', 8, { sleepHours: 5, pain: 'Fastidio al gomito' })
    const snapshot = JSON.stringify(recent)
    const alerts = getRecoveryAlerts([recent])
    expect(alerts.map(alert => alert.id)).toContain('pain')
    expect(alerts.map(alert => alert.id)).toContain('sleep')
    expect(JSON.stringify(recent)).toBe(snapshot)
  })

  it('does not infer a decline when load changed between sessions', () => {
    const alerts = getRecoveryAlerts([
      workout('newest-heavy', '2026-10-28', 8, { addedLoadKg: 10 }),
      workout('middle', '2026-10-27', 10, { addedLoadKg: 5 }),
      workout('oldest', '2026-10-26', 12, { addedLoadKg: 0 }),
    ])
    expect(alerts.some(alert => alert.id === 'decline')).toBe(false)
  })

  it('flags high perceived fatigue', () => {
    const alerts = getRecoveryAlerts([workout('fatigued', '2026-10-28', 8, { fatigue: 9 })])
    expect(alerts.map(alert => alert.id)).toContain('fatigue')
  })
})

describe('strength progression rules', () => {
  it('suggests a load step only when the prior target was cleanly achieved', () => {
    const history = [workout('strength', '2026-10-28', 8)]
    const suggestion = suggestStrengthProgression(history, 'pull-up', 'Strict')
    expect(suggestion?.nextRepTarget).toBe(9)
  })
})

describe('weekly program', () => {
  it('reduces two-set back-off exercises in deload week and respects plate increments', () => {
    const monday = TRAINING_WEEK.find(day => day.id === 'mon')
    const backoff = monday?.prescriptions.find(item => item.title.includes('back-off'))
    expect(backoff).toBeDefined()
    const deload = prescriptionForWeek(backoff!, 4)
    expect(deload.sets).toBe(1)
    expect(deload.addedLoadKg).toBe(15)
  })
})

describe('backup validation', () => {
  it('upgrades a valid version 1 backup to version 2 with empty settings', () => {
    const backup = parseBackup({
      app: 'calisthenics-coach-v2',
      schemaVersion: 1,
      exportedAt: '2026-10-28T12:00:00.000Z',
      data: { workouts: [{ id: 'w1', date: '2026-10-28', setLogs: [], emomLogs: [] }], emoms: [], records: [] },
    })
    expect(backup.schemaVersion).toBe(2)
    expect(backup.settings.cycleWeek).toBe(1)
    expect(backup.settings.strengthPlanOverrides).toHaveLength(0)
  })

  it('rejects duplicate record identifiers', () => {
    expect(() => parseBackup({
      app: 'calisthenics-coach-v2',
      schemaVersion: 1,
      exportedAt: '2026-10-28T12:00:00.000Z',
      data: { workouts: [{ id: 'dup', date: '2026-10-28', setLogs: [], emomLogs: [] }, { id: 'dup', date: '2026-10-28', setLogs: [], emomLogs: [] }], emoms: [], records: [] },
    })).toThrow(/duplicati/)
  })

  it('rejects invalid saved progression settings', () => {
    expect(() => parseBackup({
      app: 'calisthenics-coach-v2',
      schemaVersion: 2,
      exportedAt: '2026-10-28T12:00:00.000Z',
      data: { workouts: [], emoms: [], records: [] },
      settings: {
        strengthPlanOverrides: [{ exerciseId: 'pull-up', variation: 'Strict', targetReps: 6, addedLoadKg: 7, savedAt: 10 }],
        emomPlanOverrides: [],
        cycleWeek: 2,
      },
    })).toThrow(/progressioni personalizzate/)
  })
})
