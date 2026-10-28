import { useEffect, useMemo, useState } from 'react'
import { Check, Minus, Pause, Play, Plus, X } from 'lucide-react'
import { EXERCISES, type Prescription } from '../../data/program'
import type { EmomLog, SetLog, WorkoutLog } from '../../types'

type Props = {
  dayLabel: string
  prescriptions: Prescription[]
  onClose: () => void
  onFinish: (workout: WorkoutLog) => Promise<void>
}
type GuidedItem = {
  prescription: Prescription
  sets: { target: number; actual: number; completed: boolean }[]
}
const dateKey = () => {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}
const clock = (seconds: number) => {
  const n = Math.max(0, Math.floor(seconds))
  return String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0')
}
export default function GuidedWorkout({ dayLabel, prescriptions, onClose, onFinish }: Props) {
  const items = useMemo<GuidedItem[]>(() => prescriptions.filter(p => !p.optional).map(p => ({
    prescription: p,
    sets: Array.from({ length: p.durationMinutes ?? p.sets ?? 1 }, () => ({
      target: p.repsPerMinute ?? p.reps ?? 1, actual: p.repsPerMinute ?? p.reps ?? 1, completed: false,
    })),
  })), [prescriptions])
  const [current, setCurrent] = useState(0)
  const [setIndex, setSetIndex] = useState(0)
  const [progress, setProgress] = useState(items)
  const [startedAt] = useState(Date.now())
  const [now, setNow] = useState(Date.now())
  const [restSeconds, setRestSeconds] = useState(180)
  const [emomStartedAt, setEmomStartedAt] = useState<number | null>(null)
  const [restEnd, setRestEnd] = useState<number | null>(null)
  const [restPaused, setRestPaused] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [showFinish, setShowFinish] = useState(false)
  const item = progress[current]
  const p = item?.prescription
  const currentSet = item?.sets[setIndex]
  const isEmom = Boolean(p?.durationMinutes)
  const allDone = current >= progress.length
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [])
  useEffect(() => {
    setEmomStartedAt(null)
    setSetIndex(0)
  }, [current, isEmom])
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
  const markComplete = () => {
    if (isEmom && emomStartedAt === null) return
    if (currentSet?.completed) return
    setProgress(xs => xs.map((x, i) => i !== current ? x : ({
      ...x, sets: x.sets.map((s, j) => j !== setIndex ? s : { ...s, completed: true }),
    })))
    if (setIndex < (item?.sets.length ?? 1) - 1) {
      if (!isEmom) {
        setRestPaused(null)
        setRestEnd(Date.now() + restSeconds * 1000)
      }
      setSetIndex(value => value + 1)
    } else if (current < progress.length - 1) {
      setRestEnd(null); setRestPaused(null); setCurrent(value => value + 1); setSetIndex(0)
    } else setShowFinish(true)
  }
  const finish = async () => {
    if (saving) return
    setSaving(true)
    const finishedAt = Date.now()
    const setLogs: SetLog[] = []
    const emomLogs: EmomLog[] = []
    progress.forEach(({ prescription, sets }) => {
      if (prescription.durationMinutes) {
        emomLogs.push({
          id: crypto.randomUUID(), exerciseId: prescription.exerciseId, variation: prescription.variation,
          durationMinutes: sets.length, repsPerMinute: prescription.repsPerMinute ?? 1,
          addedLoadKg: prescription.addedLoadKg,
          minutes: sets.map((s, i) => ({ minute: i + 1, targetReps: s.target, actualReps: s.actual, skipped: false, completed: s.completed })),
          startedAt, endedAt: finishedAt, pausedAt: null, accumulatedPauseMs: 0, rir: null, technique: 'good', notes: '',
        })
      } else {
        sets.forEach(s => setLogs.push({
          id: crypto.randomUUID(), exerciseId: prescription.exerciseId, variation: prescription.variation,
          addedLoadKg: prescription.addedLoadKg, targetReps: s.target, actualReps: s.actual,
          rir: null, completed: s.completed, technique: 'good', notes: '', createdAt: finishedAt,
        }))
      }
    })
    const workout: WorkoutLog = {
      id: crypto.randomUUID(), date: dateKey(), dayLabel, kind: emomLogs.length && !setLogs.length ? 'emom' : 'strength',
      title: dayLabel + ' · Allenamento guidato', setLogs, emomLogs, fatigue: null, sleepHours: null,
      pain: '', notes: 'Registrato tramite Allenamento guidato.', completedAt: finishedAt,
    }
    try { await onFinish(workout) } finally { setSaving(false) }
  }
  if (!progress.length) return <div className="guided-backdrop"><div className="guided-screen"><button className="guided-close" onClick={onClose}><X/></button><h2>Nessun esercizio previsto</h2><p>Oggi è un giorno di recupero.</p></div></div>
  return <div className="guided-backdrop">
    <div className="guided-screen">
      <header className="guided-header">
        <button className="guided-close" onClick={() => { if (window.confirm('Vuoi uscire? I dati non ancora salvati andranno persi.')) onClose() }} aria-label="Esci"><X size={20}/></button>
        <div><span>ALLENAMENTO GUIDATO</span><strong>{dayLabel.toUpperCase()}</strong></div>
        <time>{clock(elapsed)}</time>
      </header>
      <div className="guided-progress"><span style={{ width: ((current + (currentSet?.completed ? 1 : 0)) / progress.length * 100) + '%' }}/></div>
      {showFinish || allDone ? <section className="guided-finish">
        <span className="eyebrow">SESSIONE COMPLETATA</span><h1>Ottimo lavoro<span>.</span></h1><strong>{clock(elapsed)}</strong>
        <p>{progress.length} esercizi · {progress.reduce((n, x) => n + x.sets.filter(s => s.completed).length, 0)} serie/minuti completati</p>
        <button className="primary-button full" disabled={saving} onClick={() => void finish()}>{saving ? 'SALVATAGGIO…' : 'SALVA ALLENAMENTO'}</button>
      </section> : <>
        <div className="guided-meta"><span>ESERCIZIO {String(current + 1).padStart(2, '0')} / {String(progress.length).padStart(2, '0')}</span><span>{isEmom ? 'EMOM' : 'FORZA'}</span></div>
        <section className="guided-exercise">
          <h1>{p?.title}</h1>
          <p>{EXERCISES.find(x => x.id === p?.exerciseId)?.name} · {p?.variation}</p>
          <div className="guided-load">{p?.addedLoadKg ? '+' + p.addedLoadKg + ' kg' : 'CORPO LIBERO'}</div>
          {isEmom && (p?.addedLoadKg ?? 0) > 0 && <div className="guided-load-editor"><span>ZAVORRA DURANTE L’EMOM</span><div className="guided-stepper"><button onClick={() => setProgress(xs => xs.map((x,i) => i !== current ? x : ({ ...x, prescription: { ...x.prescription, addedLoadKg: Math.max(0, (x.prescription.addedLoadKg ?? 0) - 5) } })))} aria-label="Diminuisci zavorra"><Minus/></button><input aria-label="Zavorra in chilogrammi" type="number" min="0" step="0.5" value={p?.addedLoadKg ?? 0} onChange={e => { const value = Math.max(0, Number(e.target.value) || 0); setProgress(xs => xs.map((x,i) => i !== current ? x : ({ ...x, prescription: { ...x.prescription, addedLoadKg: value } }))) }}/><span>kg</span><button onClick={() => setProgress(xs => xs.map((x,i) => i !== current ? x : ({ ...x, prescription: { ...x.prescription, addedLoadKg: (x.prescription.addedLoadKg ?? 0) + 5 } })))} aria-label="Aumenta zavorra"><Plus/></button></div></div>}
          <div className="guided-set-counter">{isEmom ? 'MINUTO' : 'SERIE'} <strong>{String(setIndex + 1).padStart(2, '0')}</strong><span>/ {String(item?.sets.length).padStart(2, '0')}</span></div>
          <div className="guided-target"><small>{isEmom ? 'TARGET DEL MINUTO' : 'RIPETIZIONI TARGET'}</small><strong>{currentSet?.target ?? 0}</strong><span>ripetizioni</span></div>
          <div className="guided-entry"><span>RIPETIZIONI EFFETTIVE</span><div className="guided-stepper">
            <button onClick={() => updateActual(-1)} aria-label="Diminuisci"><Minus/></button>
            <input type="number" min="0" value={currentSet?.actual ?? 0} onChange={e => setActual(Number(e.target.value))}/>
            <button onClick={() => updateActual(1)} aria-label="Aumenta"><Plus/></button>
          </div></div>
          {p?.notes && <p className="guided-notes">{p.notes}</p>}
        </section>
        {isEmom ? <>{emomStartedAt === null ? <section className="guided-rest guided-emom-start"><div><small>EMOM PRONTO</small><strong>{p?.durationMinutes}:00</strong><span>Il timer parte solo quando sei pronto.</span></div><button className="primary-button" onClick={() => setEmomStartedAt(Date.now())}><Play size={18}/> INIZIA EMOM</button></section> : <section className="guided-rest"><div><small>TIMER EMOM · TEMPO RIMANENTE</small><strong>{clock(emomRemaining)}</strong></div><div className="guided-rest-actions"><span>MINUTO {setIndex + 1}/{p?.durationMinutes} · {clock(emomMinuteRemaining)}</span></div></section>}</> : restEnd !== null || restPaused !== null ? <section className="guided-rest"><div><small>RECUPERO</small><strong>{clock(restLeft)}</strong></div><div className="guided-rest-actions"><button onClick={() => { if (restEnd !== null) { setRestPaused(Math.max(0, Math.ceil((restEnd - Date.now()) / 1000))); setRestEnd(null) } else { setRestEnd(Date.now() + (restPaused ?? restSeconds) * 1000); setRestPaused(null) } }}>{restEnd !== null ? <Pause/> : <Play/>}</button><button onClick={() => { setRestEnd(null); setRestPaused(null) }}>SALTA</button></div></section> : <div className="guided-rest-select"><span>RECUPERO</span>{[90,120,180].map(s => <button key={s} className={restSeconds === s ? 'selected' : ''} onClick={() => setRestSeconds(s)}>{s/60} min</button>)}</div>}
        <div className="guided-actions">
          <button className="guided-skip" onClick={() => { if (setIndex < (item?.sets.length ?? 1)-1) setSetIndex(v => v+1); else if (current < progress.length-1) { setCurrent(v=>v+1); setSetIndex(0) } else setShowFinish(true) }}>SALTA {isEmom ? 'MINUTO' : 'SERIE'}</button>
          <button className="primary-button" disabled={(isEmom && emomStartedAt === null) || Boolean(currentSet?.completed)} onClick={markComplete}><Check size={18}/> {currentSet?.completed ? 'MINUTO REGISTRATO' : setIndex === (item?.sets.length ?? 1)-1 ? 'COMPLETA ESERCIZIO' : 'COMPLETA ' + (isEmom ? 'MINUTO' : 'SERIE')}</button>
        </div>
        <div className="guided-up-next"><span>PROSSIMO</span><strong>{setIndex < (item?.sets.length ?? 1)-1 ? p?.title + ' · ' + (isEmom ? 'minuto ' : 'serie ') + (setIndex + 2) : progress[current + 1]?.prescription.title ?? 'Fine allenamento'}</strong></div>
      </>}
    </div>
  </div>
}
