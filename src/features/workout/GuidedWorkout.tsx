import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Minus, Pause, Play, Plus, X } from 'lucide-react'
import { EXERCISES, type Prescription } from '../../data/program'
import type { EmomLog, SetLog, WorkoutLog } from '../../types'

type Props = {
  dayLabel: string
  prescriptions: Prescription[]
  workouts: WorkoutLog[]
  onClose: () => void
  onFinish: (workout: WorkoutLog) => Promise<void>
}
type GuidedSet = { target: number; actual: number; completed: boolean; skipped: boolean }
type RoundType = 'superset' | 'circuit'
type GuidedItem = {
  prescription: Prescription
  sets: GuidedSet[]
  roundType?: RoundType
  roundNumber?: number
  roundTotal?: number
  roundEnd?: boolean
}
function makeGuidedItem(
  prescription: Prescription,
  round?: { type: RoundType; number: number; total: number; end: boolean },
): GuidedItem {
  const target = prescription.repsPerMinute ?? prescription.reps ?? 1
  const count = round ? 1 : (prescription.durationMinutes ?? prescription.sets ?? 1)
  return {
    prescription,
    sets: Array.from({ length: count }, () => ({ target, actual: target, completed: false, skipped: false })),
    ...(round ? {
      roundType: round.type,
      roundNumber: round.number,
      roundTotal: round.total,
      roundEnd: round.end,
    } : {}),
  }
}
function buildGuidedItems(prescriptions: Prescription[]): GuidedItem[] {
  const active = prescriptions.filter(p => !p.optional)
  const consumed = new Set<number>()
  const result: GuidedItem[] = []
  for (let i = 0; i < active.length; i++) {
    if (consumed.has(i)) continue
    const prescription = active[i]
    if (prescription.variation === 'Circuito') {
      const members = active.map((item, index) => ({ item, index }))
        .filter(entry => entry.item.variation === 'Circuito' && !consumed.has(entry.index))
      const total = Math.max(...members.map(entry => entry.item.sets ?? 1))
      for (let round = 0; round < total; round++) {
        const roundMembers = members.filter(entry => round < (entry.item.sets ?? 1))
        roundMembers.forEach((entry, memberIndex) => {
          result.push(makeGuidedItem(entry.item, {
            type: 'circuit', number: round + 1, total, end: memberIndex === roundMembers.length - 1,
          }))
        })
      }
      members.forEach(entry => consumed.add(entry.index))
      continue
    }
    if (prescription.pairedWith) {
      const partnerIndex = active.findIndex((candidate, index) =>
        index !== i && !consumed.has(index) &&
        candidate.exerciseId === prescription.pairedWith &&
        candidate.pairedWith === prescription.exerciseId &&
        candidate.variation === prescription.variation
      )
      if (partnerIndex >= 0) {
        const pair = [{ item: prescription, index: i }, { item: active[partnerIndex], index: partnerIndex }]
        const total = Math.max(...pair.map(entry => entry.item.sets ?? 1))
        for (let round = 0; round < total; round++) {
          const roundMembers = pair.filter(entry => round < (entry.item.sets ?? 1))
          roundMembers.forEach((entry, memberIndex) => {
            result.push(makeGuidedItem(entry.item, {
              type: 'superset', number: round + 1, total, end: memberIndex === roundMembers.length - 1,
            }))
          })
        }
        consumed.add(i)
        consumed.add(partnerIndex)
        continue
      }
    }
    result.push(makeGuidedItem(prescription))
    consumed.add(i)
  }
  return result
}
function previousPerformance(workouts: WorkoutLog[], prescription: Prescription, index: number) {
  const sessions = [...workouts]
    .filter(workout => workout.completedAt !== null)
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
  for (const workout of sessions) {
    if (prescription.durationMinutes !== undefined) {
      const log = [...workout.emomLogs].reverse().find(entry =>
        entry.exerciseId === prescription.exerciseId && entry.variation === prescription.variation
      )
      if (!log) continue
      const minute = log.minutes.find(entry => entry.minute === index + 1)
      if (!minute) continue
      const load = log.addedLoadKg > 0 ? '+ ' + log.addedLoadKg + ' kg' : 'corpo libero'
      const status = minute.skipped ? ' · saltato' : ''
      return { reps: minute.actualReps, detail: 'Minuto ' + minute.minute + status + ' · ' + load + ' · ' + workout.date }
    }
    const matching = workout.setLogs.filter(entry =>
      entry.exerciseId === prescription.exerciseId && entry.variation === prescription.variation
    )
    if (!matching.length) continue
    const set = matching[index] ?? matching[matching.length - 1]
    const load = set.addedLoadKg > 0 ? '+ ' + set.addedLoadKg + ' kg' : 'corpo libero'
    const status = !set.completed ? (set.actualReps === 0 ? ' · non completata' : ' · parziale') : ''
    return { reps: set.actualReps, detail: 'Serie ' + Math.min(index + 1, matching.length) + status + ' · ' + load + ' · ' + workout.date }
  }
  return null
}

const dateKey = () => {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}
const clock = (seconds: number) => {
  const n = Math.max(0, Math.floor(seconds))
  return String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0')
}
export default function GuidedWorkout({ dayLabel, prescriptions, workouts, onClose, onFinish }: Props) {
  const items = useMemo<GuidedItem[]>(() => buildGuidedItems(prescriptions), [prescriptions])
  const [current, setCurrent] = useState(0)
  const [setIndex, setSetIndex] = useState(0)
  const [progress, setProgress] = useState(items)
  const [startedAt] = useState(Date.now())
  const [now, setNow] = useState(Date.now())
  const [restSeconds, setRestSeconds] = useState(120)
  const [emomStartedAt, setEmomStartedAt] = useState<number | null>(null)
  const [restEnd, setRestEnd] = useState<number | null>(null)
  const [restPaused, setRestPaused] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [showFinish, setShowFinish] = useState(false)
  const [loadDraft, setLoadDraft] = useState('')
  const completionLock = useRef(false)
  const finishLock = useRef(false)
  const workoutId = useRef<string | null>(null)
  if (workoutId.current === null) workoutId.current = crypto.randomUUID()
  const item = progress[current]
  const p = item?.prescription
  const currentSet = item?.sets[setIndex]
  const isEmom = Boolean(p?.durationMinutes)
  const performanceIndex = item?.roundNumber ? item.roundNumber - 1 : setIndex
  const lastPerformance = p ? previousPerformance(workouts, p, performanceIndex) : null
  const allDone = current >= progress.length
  const totalUnits = progress.reduce((sum, entry) => sum + entry.sets.length, 0)
  const completedUnits = progress.slice(0, current).reduce((sum, entry) => sum + entry.sets.length, 0) +
    setIndex + (currentSet?.completed ? 1 : 0)
  const progressPercent = totalUnits ? Math.min(100, completedUnits / totalUnits * 100) : 0
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [])
  useEffect(() => {
    setEmomStartedAt(null)
    setSetIndex(0)
  }, [current, isEmom])
  useEffect(() => {
    setLoadDraft(String(p?.addedLoadKg ?? 0))
    completionLock.current = false
  }, [current, setIndex, p?.addedLoadKg])
  useEffect(() => {
    if (restEnd === null) return
    if (now >= restEnd) { setRestEnd(null); setRestPaused(0) }
  }, [now, restEnd])
  const elapsed = Math.floor((now - startedAt) / 1000)
  const restLeft = restEnd !== null ? Math.max(0, Math.ceil((restEnd - now) / 1000)) : restPaused ?? restSeconds
  const emomDuration = (p?.durationMinutes ?? 0) * 60
  const emomElapsed = emomStartedAt === null ? 0 : Math.max(0, Math.floor((now - emomStartedAt) / 1000))
  const emomRemaining = Math.max(0, emomDuration - emomElapsed)
  const emomMinuteRemaining = emomStartedAt === null ? 60 : emomRemaining === 0 ? 0 : 60 - (emomElapsed % 60)
  const updateActual = (delta: number) => setProgress(xs => xs.map((x, i) => i !== current ? x : ({
    ...x, sets: x.sets.map((s, j) => j !== setIndex ? s : { ...s, actual: Math.max(0, s.actual + delta) }),
  })))
  const setActual = (value: number) => setProgress(xs => xs.map((x, i) => i !== current ? x : ({
    ...x, sets: x.sets.map((s, j) => j !== setIndex ? s : { ...s, actual: Math.max(0, value) }),
  })))
  const advanceCurrent = () => {
    if (setIndex < (item?.sets.length ?? 1) - 1) {
      if (!isEmom) {
        setRestPaused(null)
        setRestEnd(Date.now() + restSeconds * 1000)
      }
      setSetIndex(value => value + 1)
    } else if (current < progress.length - 1) {
      if (item?.roundEnd && (progress[current + 1]?.roundType === item.roundType || item.roundType === 'superset')) {
        const duration = item.roundType === 'circuit' ? Math.max(180, restSeconds) : restSeconds
        setRestPaused(null)
        setRestEnd(Date.now() + duration * 1000)
      } else {
        setRestEnd(null)
        setRestPaused(null)
      }
      setCurrent(value => value + 1)
      setSetIndex(0)
    } else {
      setShowFinish(true)
    }
  }
  const markComplete = () => {
    if ((isEmom && emomStartedAt === null) || currentSet?.completed || currentSet?.skipped || completionLock.current) return
    completionLock.current = true
    setProgress(xs => xs.map((x, i) => i !== current ? x : ({
      ...x, sets: x.sets.map((s, j) => j !== setIndex ? s : { ...s, completed: true, skipped: false }),
    })))
    advanceCurrent()
  }
  const skipCurrent = () => {
    if ((isEmom && emomStartedAt === null) || currentSet?.completed || currentSet?.skipped || completionLock.current) return
    completionLock.current = true
    setProgress(xs => xs.map((x, i) => i !== current ? x : ({
      ...x, sets: x.sets.map((s, j) => j !== setIndex ? s : { ...s, actual: 0, completed: false, skipped: true }),
    })))
    advanceCurrent()
  }
  const finish = async () => {
    if (saving || finishLock.current) return
    finishLock.current = true
    setSaving(true)
    setSaveError('')
    const finishedAt = Date.now()
    const setLogs: SetLog[] = []
    const emomLogs: EmomLog[] = []
    progress.forEach(({ prescription, sets }) => {
      if (prescription.durationMinutes) {
        emomLogs.push({
          id: crypto.randomUUID(), exerciseId: prescription.exerciseId, variation: prescription.variation,
          durationMinutes: sets.length, repsPerMinute: prescription.repsPerMinute ?? 1,
          addedLoadKg: prescription.addedLoadKg,
          minutes: sets.map((s, i) => ({ minute: i + 1, targetReps: s.target, actualReps: s.skipped ? 0 : s.actual, skipped: s.skipped, completed: s.completed && !s.skipped })),
          startedAt, endedAt: finishedAt, pausedAt: null, accumulatedPauseMs: 0, rir: null, technique: 'good', notes: '',
        })
      } else {
        sets.forEach(s => setLogs.push({
          id: crypto.randomUUID(), exerciseId: prescription.exerciseId, variation: prescription.variation,
          addedLoadKg: prescription.addedLoadKg, targetReps: s.target, actualReps: s.skipped ? 0 : s.actual,
          rir: null, completed: s.completed && !s.skipped, technique: 'good',
          notes: s.skipped ? 'Saltata nell’allenamento guidato.' : '', createdAt: finishedAt,
        }))
      }
    })
    const workout: WorkoutLog = {
      id: workoutId.current ?? crypto.randomUUID(), date: dateKey(), dayLabel, kind: emomLogs.length && !setLogs.length ? 'emom' : 'strength',
      title: dayLabel + ' · Allenamento guidato', setLogs, emomLogs, fatigue: null, sleepHours: null,
      pain: '', notes: 'Registrato tramite Allenamento guidato.', completedAt: finishedAt,
    }
    try {
      await onFinish(workout)
    } catch {
      finishLock.current = false
      setSaveError('Salvataggio non riuscito. I dati restano aperti: riprova senza uscire.')
    } finally {
      setSaving(false)
    }
  }
  if (!progress.length) return <div className="guided-backdrop"><div className="guided-screen"><button className="guided-close" onClick={onClose}><X/></button><h2>Nessun esercizio previsto</h2><p>Oggi è un giorno di recupero.</p></div></div>
  return <div className="guided-backdrop">
    <div className="guided-screen">
      <header className="guided-header">
        <button className="guided-close" onClick={() => { if (window.confirm('Vuoi uscire? I dati non ancora salvati andranno persi.')) onClose() }} aria-label="Esci"><X size={20}/></button>
        <div><span>ALLENAMENTO GUIDATO</span><strong>{dayLabel.toUpperCase()}</strong></div>
        <time>{clock(elapsed)}</time>
      </header>
      <div className="guided-progress"><span style={{ width: progressPercent + '%' }}/></div>
      {showFinish || allDone ? <section className="guided-finish">
        <span className="eyebrow">SESSIONE COMPLETATA</span><h1>Ottimo lavoro<span>.</span></h1><strong>{clock(elapsed)}</strong>
        <p>{progress.reduce((n, x) => n + x.sets.filter(s => s.completed).length, 0)} completati · {progress.reduce((n, x) => n + x.sets.filter(s => s.skipped).length, 0)} saltati</p>
        {saveError && <p className="guided-save-error" role="alert">{saveError}</p>}
        <button className="primary-button full" disabled={saving} onClick={() => void finish()}>{saving ? 'SALVATAGGIO…' : 'SALVA ALLENAMENTO'}</button>
      </section> : <>
        <div className="guided-meta"><span>{item?.roundType ? (item.roundType === 'circuit' ? 'CIRCUITO' : 'SUPERSET') : 'ESERCIZIO ' + String(current + 1).padStart(2, '0') + ' / ' + String(progress.length).padStart(2, '0')}</span><span>{isEmom ? 'EMOM' : 'FORZA'}</span></div>
        <section className="guided-exercise">
          <h1>{p?.title}</h1>
          <p>{EXERCISES.find(x => x.id === p?.exerciseId)?.name} · {p?.variation}</p>
          <div className="guided-load">{(p?.addedLoadKg ?? 0) > 0 ? '+' + p?.addedLoadKg + ' kg' : 'CORPO LIBERO'}</div>
          <div className="guided-load-editor"><span>ZAVORRA {isEmom ? 'DURANTE L’EMOM' : 'ESERCIZIO'}</span><div className="guided-stepper"><button type="button" onClick={() => { const value = Math.max(0, (p?.addedLoadKg ?? 0) - 5); setProgress(xs => xs.map(x => x.prescription.exerciseId !== p?.exerciseId || x.prescription.variation !== p?.variation ? x : ({ ...x, prescription: { ...x.prescription, addedLoadKg: value } }))); setLoadDraft(String(value)) }} aria-label="Diminuisci zavorra"><Minus/></button><input aria-label="Zavorra in chilogrammi" type="text" inputMode="numeric" pattern="[0-9]*" value={loadDraft} onChange={e => setLoadDraft(e.target.value)} onBlur={() => { const parsed = loadDraft.trim() === '' ? (p?.addedLoadKg ?? 0) : Number(loadDraft); const value = Number.isFinite(parsed) ? Math.min(30, Math.max(0, Math.round(parsed / 5) * 5)) : (p?.addedLoadKg ?? 0); setProgress(xs => xs.map(x => x.prescription.exerciseId !== p?.exerciseId || x.prescription.variation !== p?.variation ? x : ({ ...x, prescription: { ...x.prescription, addedLoadKg: value } }))); setLoadDraft(String(value)) }} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}/><span>kg</span><button type="button" onClick={() => { const value = Math.min(30, (p?.addedLoadKg ?? 0) + 5); setProgress(xs => xs.map(x => x.prescription.exerciseId !== p?.exerciseId || x.prescription.variation !== p?.variation ? x : ({ ...x, prescription: { ...x.prescription, addedLoadKg: value } }))); setLoadDraft(String(value)) }} aria-label="Aumenta zavorra"><Plus/></button></div><small>Incrementi disponibili: 0, 5, 10, 15, 20, 25 o 30 kg.</small></div>
          <div className="guided-set-counter">{item?.roundType ? 'ROUND' : isEmom ? 'MINUTO' : 'SERIE'} <strong>{String(item?.roundType ? item.roundNumber : setIndex + 1).padStart(2, '0')}</strong><span>/ {String(item?.roundType ? item.roundTotal : item?.sets.length).padStart(2, '0')}</span></div>
          <div className="guided-target"><small>{isEmom ? 'TARGET DEL MINUTO' : 'RIPETIZIONI TARGET'}</small><strong>{currentSet?.target ?? 0}</strong><span>ripetizioni</span></div>
          {lastPerformance && <div className="guided-last-time"><div><small>SCORSA VOLTA</small><strong>{lastPerformance.reps} <span>rep</span></strong></div><span>{lastPerformance.detail}</span></div>}
          <div className="guided-entry"><span>RIPETIZIONI EFFETTIVE</span><div className="guided-stepper">
            <button onClick={() => updateActual(-1)} aria-label="Diminuisci"><Minus/></button>
            <input type="number" min="0" value={currentSet?.actual ?? 0} onChange={e => setActual(Number(e.target.value))}/>
            <button onClick={() => updateActual(1)} aria-label="Aumenta"><Plus/></button>
          </div></div>
          {p?.notes && <p className="guided-notes">{p.notes}</p>}
        </section>
        {isEmom ? <>{emomStartedAt === null ? (restEnd !== null || (restPaused !== null && restPaused > 0) ? <section className="guided-rest"><div><small>RECUPERO PRIMA DELL’EMOM</small><strong>{clock(restLeft)}</strong></div><div className="guided-rest-actions"><button onClick={() => { setRestEnd(null); setRestPaused(0) }}>SALTA</button></div></section> : <section className="guided-rest guided-emom-start"><div><small>EMOM PRONTO</small><strong>{p?.durationMinutes}:00</strong><span>Il timer parte solo quando sei pronto.</span></div><button className="primary-button" onClick={() => setEmomStartedAt(Date.now())}><Play size={18}/> INIZIA EMOM</button></section>) : <section className="guided-rest"><div><small>TIMER EMOM · TEMPO RIMANENTE</small><strong>{clock(emomRemaining)}</strong></div><div className="guided-rest-actions"><span>MINUTO {setIndex + 1}/{p?.durationMinutes} · {clock(emomMinuteRemaining)}</span></div></section>}</> : restEnd !== null || restPaused !== null ? <section className="guided-rest"><div><small>RECUPERO</small><strong>{clock(restLeft)}</strong></div><div className="guided-rest-actions"><button onClick={() => { if (restEnd !== null) { setRestPaused(Math.max(0, Math.ceil((restEnd - Date.now()) / 1000))); setRestEnd(null) } else { setRestEnd(Date.now() + (restPaused ?? restSeconds) * 1000); setRestPaused(null) } }}>{restEnd !== null ? <Pause/> : <Play/>}</button><button onClick={() => { setRestEnd(null); setRestPaused(null) }}>SALTA</button></div></section> : <div className="guided-rest-select"><span>RECUPERO</span>{[90,120,180].map(s => <button key={s} className={restSeconds === s ? 'selected' : ''} onClick={() => setRestSeconds(s)}>{s/60} min</button>)}</div>}
        <div className="guided-actions">
          <button className="guided-skip" disabled={(isEmom && emomStartedAt === null) || Boolean(currentSet?.completed) || Boolean(currentSet?.skipped)} onClick={skipCurrent}>SALTA {isEmom ? 'MINUTO' : 'SERIE'}</button>
          <button className="primary-button" disabled={(isEmom && emomStartedAt === null) || Boolean(currentSet?.completed) || Boolean(currentSet?.skipped)} onClick={markComplete}><Check size={18}/> {currentSet?.completed ? 'REGISTRATO' : item?.roundType ? (item.roundEnd ? 'COMPLETA ROUND' : 'REGISTRA') : setIndex === (item?.sets.length ?? 1)-1 ? 'COMPLETA ESERCIZIO' : 'COMPLETA ' + (isEmom ? 'MINUTO' : 'SERIE')}</button>
        </div>
        <div className="guided-up-next"><span>PROSSIMO</span><strong>{setIndex < (item?.sets.length ?? 1)-1 ? p?.title + ' · ' + (isEmom ? 'minuto ' : 'serie ') + (setIndex + 2) : progress[current + 1] ? (progress[current + 1]?.roundType ? 'Round ' + progress[current + 1]?.roundNumber + ' · ' : '') + progress[current + 1]?.prescription.title : 'Fine allenamento'}</strong></div>
      </>}
    </div>
  </div>
}
