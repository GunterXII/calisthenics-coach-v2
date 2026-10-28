import { useEffect, useMemo, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../database/db'
import { EXERCISES } from '../../data/program'
import { suggestEmomProgression } from '../../domain/progression'
import { getEmomPlanOverride, saveEmomPlanOverride } from '../../domain/emomPlanOverrides'
import type { EmomLog, ExerciseId } from '../../types'

const DRAFT_KEY = 'calisthenics-coach-v2:active-emom:v1'

interface EmomDraft {
  version: 1
  exerciseId: ExerciseId
  variation: string
  duration: number
  repsPerMinute: number
  load: number
  startedAt: number | null
  pausedAt: number | null
  pauseMs: number
  minutes: EmomLog['minutes']
  activeInputMinute: number
  actualInput: string
  actualTouched: boolean
  rir: number
  technique: EmomLog['technique']
  notes: string
  progressionChoice?: 'accepted' | 'kept' | 'editing' | 'custom' | null
  nextPlanReps?: number
  nextPlanLoad?: number
}

function readDraft(): EmomDraft | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<EmomDraft>
    if (value.version !== 1 || !Array.isArray(value.minutes) || typeof value.startedAt !== 'number') return null
    return value as EmomDraft
  } catch {
    return null
  }
}

function localDateString(timestamp: number) {
  const date = new Date(timestamp)
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0')
}

function formatClock(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds))
  return String(Math.floor(safe / 60)).padStart(2, '0') + ':' + String(safe % 60).padStart(2, '0')
}

function isClean(log: EmomLog) {
  return log.minutes.length === log.durationMinutes &&
    log.minutes.every(m => !m.skipped && m.actualReps >= m.targetReps) &&
    log.technique === 'good' && (log.rir ?? 0) >= 2
}

type EmomConfig = { exerciseId: ExerciseId; variation: string; duration: number; repsPerMinute: number; load: number }

export default function EmomRunner({ onClose, initialConfig, progressionEnabled = true }: { onClose: () => void; initialConfig?: EmomConfig; progressionEnabled?: boolean }) {
  const [initialDraft] = useState<EmomDraft | null>(readDraft)
  const defaultExercise = initialDraft?.exerciseId ?? initialConfig?.exerciseId ?? 'pull-up'
  const defaultVariation = initialDraft?.variation ?? initialConfig?.variation ?? 'Strict'
  const [exerciseId, setExerciseId] = useState<ExerciseId>(defaultExercise)
  const [variation, setVariation] = useState(defaultVariation)
  const [initialPlanOverride] = useState(() => progressionEnabled ? getEmomPlanOverride(defaultExercise, defaultVariation) : null)
  const [duration, setDuration] = useState(initialDraft?.duration ?? initialConfig?.duration ?? initialPlanOverride?.duration ?? 10)
  const [repsPerMinute, setRepsPerMinute] = useState(initialDraft?.repsPerMinute ?? initialConfig?.repsPerMinute ?? initialPlanOverride?.repsPerMinute ?? 6)
  const [load, setLoad] = useState(initialDraft?.load ?? initialConfig?.load ?? initialPlanOverride?.load ?? 0)
  const [progressionChoice, setProgressionChoice] = useState<'accepted' | 'kept' | 'editing' | 'custom' | null>(initialDraft?.progressionChoice ?? null)
  const [nextPlanReps, setNextPlanReps] = useState(initialDraft?.nextPlanReps ?? repsPerMinute)
  const [nextPlanLoad, setNextPlanLoad] = useState(initialDraft?.nextPlanLoad ?? load)
  const [startedAt, setStartedAt] = useState<number | null>(initialDraft?.startedAt ?? null)
  const [pausedAt, setPausedAt] = useState<number | null>(initialDraft?.pausedAt ?? null)
  const [pauseMs, setPauseMs] = useState(initialDraft?.pauseMs ?? 0)
  const [now, setNow] = useState(Date.now())
  const [minutes, setMinutes] = useState<EmomLog['minutes']>(initialDraft?.minutes ?? [])
  const [activeInputMinute, setActiveInputMinute] = useState(initialDraft?.activeInputMinute ?? 1)
  const [actualInput, setActualInput] = useState(typeof initialDraft?.actualInput === 'string' && initialDraft.actualInput !== '' ? initialDraft.actualInput : String(initialDraft?.repsPerMinute ?? initialConfig?.repsPerMinute ?? initialPlanOverride?.repsPerMinute ?? 6))
  const [actualTouched, setActualTouched] = useState(initialDraft?.actualTouched ?? false)
  const [rir, setRir] = useState(initialDraft?.rir ?? 2)
  const [technique, setTechnique] = useState<EmomLog['technique']>(initialDraft?.technique ?? 'good')
  const [notes, setNotes] = useState(initialDraft?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const history = useLiveQuery(() => db.emoms.orderBy('startedAt').reverse().toArray(), []) ?? []

  const elapsedMs = startedAt === null ? 0 : Math.max(0, (pausedAt ?? now) - startedAt - pauseMs)
  const elapsedSeconds = Math.floor(elapsedMs / 1000)
  const completedMinutes = Math.min(duration, Math.floor(elapsedSeconds / 60))
  const currentMinute = startedAt === null ? 1 : Math.min(duration, completedMinutes + 1)
  const complete = startedAt !== null && elapsedSeconds >= duration * 60
  const running = startedAt !== null && pausedAt === null && !complete
  const totalRemaining = Math.max(0, duration * 60 - elapsedSeconds)
  const minuteRemaining = startedAt === null ? 60 : complete ? 0 : 60 - (elapsedSeconds % 60)
  const progress = Math.min(100, (elapsedSeconds / (duration * 60)) * 100)
  const totalClock = useMemo(() => formatClock(totalRemaining), [totalRemaining])
  const minuteClock = useMemo(() => formatClock(minuteRemaining), [minuteRemaining])

  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [running])

  useEffect(() => {
    if (startedAt !== null || initialDraft || !progressionEnabled) return
    const saved = getEmomPlanOverride(exerciseId, variation)
    if (saved) {
      setDuration(saved.duration)
      setRepsPerMinute(saved.repsPerMinute)
      setLoad(saved.load)
      setActualInput(String(saved.repsPerMinute))
    } else {
      setActualInput(String(repsPerMinute))
    }
  }, [exerciseId, variation, startedAt, initialDraft, progressionEnabled, repsPerMinute])

  // Chiude automaticamente i minuti scaduti. Se è stata digitata una prestazione,
  // la usa per il minuto corrente; i minuti non inseriti vengono marcati come saltati.
  useEffect(() => {
    if (startedAt === null || completedMinutes < 1) return
    setMinutes(previous => {
      const known = new Set(previous.map(m => m.minute))
      const next = [...previous]
      for (let minute = 1; minute <= completedMinutes; minute += 1) {
        if (known.has(minute)) continue
        const hasInput = minute === activeInputMinute
        const actual = hasInput ? Math.max(0, Number(actualInput) || 0) : 0
        next.push({
          minute,
          targetReps: repsPerMinute,
          actualReps: actual,
          skipped: !hasInput,
          completed: hasInput && actual >= repsPerMinute,
        })
        known.add(minute)
      }
      return next.sort((a, b) => a.minute - b.minute)
    })
    if (activeInputMinute <= completedMinutes) {
      setActualInput(String(repsPerMinute))
      setActualTouched(false)
      setActiveInputMinute(Math.min(duration, completedMinutes + 1))
    }
  }, [completedMinutes, startedAt])

  // Draft locale scritto a ogni modifica significativa: chiudere o ricaricare la pagina
  // non elimina la sessione. Al riavvio il cronometro recupera il tempo reale trascorso.
  useEffect(() => {
    if (startedAt === null) {
      try { window.localStorage.removeItem(DRAFT_KEY) } catch {}
      return
    }
    const draft: EmomDraft = {
      version: 1, exerciseId, variation, duration, repsPerMinute, load, startedAt,
      pausedAt, pauseMs, minutes, activeInputMinute, actualInput, actualTouched, rir, technique, notes,
      progressionChoice, nextPlanReps, nextPlanLoad,
    }
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
    } catch {
      // Il timer continua a funzionare anche se lo storage non è disponibile.
    }
  }, [exerciseId, variation, duration, repsPerMinute, load, startedAt, pausedAt, pauseMs, minutes, activeInputMinute, actualInput, actualTouched, rir, technique, notes, progressionChoice, nextPlanReps, nextPlanLoad])

  const begin = () => {
    const timestamp = Date.now()
    setStartedAt(timestamp)
    setPausedAt(null)
    setPauseMs(0)
    setMinutes([])
    setActiveInputMinute(1)
    setActualInput(String(repsPerMinute))
    setActualTouched(false)
    setNow(timestamp)
  }

  const pause = () => {
    setPausedAt(Date.now())
    setNow(Date.now())
  }

  const resume = () => {
    if (pausedAt !== null) setPauseMs(value => value + Date.now() - pausedAt)
    setPausedAt(null)
    setNow(Date.now())
  }

  const recordMinute = (skipped = false) => {
    if (startedAt === null) return
    const minute = Math.min(duration, Math.max(1, currentMinute))
    const actual = skipped ? 0 : Math.max(0, Number(actualInput) || 0)
    setMinutes(previous => {
      const byMinute = new Map(previous.map(item => [item.minute, item]))
      // Se l'utente è rimasto indietro, non fingiamo che i minuti precedenti siano riusciti.
      for (let missed = 1; missed < minute; missed += 1) {
        if (!byMinute.has(missed)) byMinute.set(missed, { minute: missed, targetReps: repsPerMinute, actualReps: 0, skipped: true, completed: false })
      }
      byMinute.set(minute, {
        minute, targetReps: repsPerMinute, actualReps: actual, skipped,
        completed: !skipped && actual >= repsPerMinute,
      })
      return [...byMinute.values()].sort((a, b) => a.minute - b.minute)
    })
    setActualInput(String(repsPerMinute))
    setActualTouched(false)
    setActiveInputMinute(minute < duration ? minute + 1 : duration)
  }

  const finish = async () => {
    if (startedAt === null || saving) return
    setSaving(true)
    try {
      const endTimestamp = Date.now()
      const effectiveEnd = pausedAt ?? endTimestamp
      const elapsedAtSave = Math.max(0, Math.floor((effectiveEnd - startedAt - pauseMs) / 1000))
      const completedAtSave = Math.min(duration, Math.floor(elapsedAtSave / 60))
      const byMinute = new Map(minutes.map(item => [item.minute, item]))
      for (let minute = 1; minute <= completedAtSave; minute += 1) {
        if (!byMinute.has(minute)) {
          const hasInput = minute === activeInputMinute
          const actual = hasInput ? Math.max(0, Number(actualInput) || 0) : 0
          byMinute.set(minute, { minute, targetReps: repsPerMinute, actualReps: actual, skipped: !hasInput, completed: hasInput && actual >= repsPerMinute })
        }
      }
      if (activeInputMinute > completedAtSave && actualTouched && !byMinute.has(activeInputMinute)) {
        const actual = Math.max(0, Number(actualInput) || 0)
        byMinute.set(activeInputMinute, {
          minute: activeInputMinute, targetReps: repsPerMinute, actualReps: actual,
          skipped: false, completed: actual >= repsPerMinute,
        })
      }
      const finalMinutes = [...byMinute.values()].sort((a, b) => a.minute - b.minute)
      const log: EmomLog = {
        id: crypto.randomUUID(), exerciseId, variation, durationMinutes: duration,
        repsPerMinute, addedLoadKg: load, minutes: finalMinutes, startedAt,
        endedAt: endTimestamp, pausedAt: null, accumulatedPauseMs: pauseMs + (pausedAt !== null ? endTimestamp - pausedAt : 0), rir,
        technique, notes,
      }
      const workout = {
        id: crypto.randomUUID(),
        date: localDateString(startedAt),
        dayLabel: 'Sessione EMOM',
        kind: 'emom' as const,
        title: (EXERCISES.find(e => e.id === exerciseId)?.name ?? 'EMOM') + ' · ' + duration + ' min',
        setLogs: [],
        emomLogs: [log],
        fatigue: null,
        sleepHours: null,
        pain: technique === 'pain' ? 'Dolore segnalato durante EMOM' : '',
        notes,
        completedAt: endTimestamp,
      }
      await db.transaction('rw', db.emoms, db.workouts, async () => {
        await db.emoms.add(log)
        await db.workouts.add(workout)
      })
      if (progressionChoice && progressionChoice !== 'editing' && suggestion) {
        const nextReps = progressionChoice === 'accepted'
          ? (suggestion.nextRepsPerMinute ?? repsPerMinute)
          : progressionChoice === 'kept' ? repsPerMinute : nextPlanReps
        const nextLoad = progressionChoice === 'accepted'
          ? (suggestion.nextLoadKg ?? load)
          : progressionChoice === 'kept' ? load : nextPlanLoad
        saveEmomPlanOverride({ exerciseId, variation, duration, repsPerMinute: nextReps, load: nextLoad, savedAt: Date.now() })
      }
      window.localStorage.removeItem(DRAFT_KEY)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const priorSameLoad = history.filter(log =>
    log.startedAt < (startedAt ?? Date.now()) &&
    log.exerciseId === exerciseId && log.variation === variation && log.addedLoadKg === load
  ).sort((a, b) => b.startedAt - a.startedAt)
  let cleanStreak = 0
  for (const previous of priorSameLoad) {
    if (!isClean(previous)) break
    cleanStreak += 1
  }
  const preview: EmomLog = {
    id: 'preview', exerciseId, variation, durationMinutes: duration, repsPerMinute,
    addedLoadKg: load, minutes, startedAt: startedAt ?? Date.now(), endedAt: null,
    pausedAt, accumulatedPauseMs: pauseMs, rir, technique, notes,
  }
  const suggestion = progressionEnabled && startedAt !== null && complete && minutes.length >= duration ? suggestEmomProgression(preview, cleanStreak) : null
  const totalLoggedReps = minutes.reduce((sum, item) => sum + item.actualReps, 0)
  const saveNextPlan = (mode: 'accepted' | 'kept' | 'custom') => {
    if (!suggestion) return
    if (mode === 'accepted') {
      setNextPlanReps(suggestion.nextRepsPerMinute ?? repsPerMinute)
      setNextPlanLoad(suggestion.nextLoadKg ?? load)
    } else if (mode === 'kept') {
      setNextPlanReps(repsPerMinute)
      setNextPlanLoad(load)
    }
    // The choice remains a draft until the workout itself is saved.
    setProgressionChoice(mode)
  }

  return <div className="modal-backdrop"><div className="modal emom-modal">
    <div className="modal-head"><div><div className="eyebrow">SESSIONE STRUTTURATA</div><h2>EMOM runner</h2></div><button className="close-button" onClick={onClose} aria-label="Chiudi; sessione salvata automaticamente">×</button></div>
    {!progressionEnabled && <div className="deload-banner"><strong>DELOAD · PROGRESSIONE IN PAUSA</strong><span>I target alleggeriti restano attivi; le proposte di aumento automatico sono disattivate durante questa settimana.</span></div>}
    {startedAt === null ? <>
      {initialDraft && startedAt === null && <p className="muted emom-resume-note">La bozza precedente non era stata avviata. Puoi iniziare con la configurazione qui sotto.</p>}
      <label>Esercizio<select value={exerciseId} onChange={e => setExerciseId(e.target.value as ExerciseId)}>{EXERCISES.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
      <label>Variante<input value={variation} onChange={e => setVariation(e.target.value)} /></label>
      <div className="form-grid"><label>Durata (min)<input type="number" min="1" max="60" value={duration} onChange={e => setDuration(Math.min(60, Math.max(1, Number(e.target.value) || 1)))} /></label><label>Reps / min<input type="number" min="1" max="100" value={repsPerMinute} onChange={e => { const value = Math.min(100, Math.max(1, Number(e.target.value) || 1)); setRepsPerMinute(value); setActualInput(String(value)) }} /></label></div>
      <label>Zavorra<select value={load} onChange={e => setLoad(Number(e.target.value))}>{[0, 5, 10, 15, 20, 25, 30].map(v => <option key={v} value={v}>{v} kg</option>)}</select></label>
      <button className="primary-button full" onClick={begin}>INIZIA EMOM</button>
    </> : <>
      <div className="emom-clock">
        <small>MINUTO {Math.min(currentMinute, duration)} / {duration}{complete ? ' · COMPLETATO' : ''}</small>
        <strong>{minuteClock}</strong>
        <div className="progress-track"><span style={{ width: progress + '%' }} /></div>
        <div className="emom-clock-meta"><span>Tempo totale rimanente</span><strong>{totalClock}</strong><span>Target per minuto</span><strong>{repsPerMinute} reps</strong></div>
        <p>{EXERCISES.find(item => item.id === exerciseId)?.name} · {load} kg · {formatClock(elapsedSeconds)} trascorsi</p>
        {pausedAt !== null && <p className="emom-paused-label">Timer in pausa</p>}
      </div>

      <div className="emom-current-entry">
        <div className="current-entry-title"><strong>Quante ripetizioni hai fatto?</strong><span>MINUTO {Math.min(currentMinute, duration)}</span></div>
        <div className="emom-rep-stepper">
          <button type="button" aria-label="Diminuisci una ripetizione" onClick={() => { setActualInput(String(Math.max(0, (Number(actualInput) || 0) - 1))); setActualTouched(true); setActiveInputMinute(currentMinute) }} disabled={complete || pausedAt !== null}><Minus size={19}/></button>
          <input aria-label="Ripetizioni effettive del minuto" type="number" min="0" max="500" value={actualInput} onChange={e => { setActualInput(e.target.value); setActualTouched(true); setActiveInputMinute(currentMinute) }} disabled={complete || pausedAt !== null}/>
          <button type="button" aria-label="Aumenta una ripetizione" onClick={() => { setActualInput(String(Math.min(500, (Number(actualInput) || 0) + 1))); setActualTouched(true); setActiveInputMinute(currentMinute) }} disabled={complete || pausedAt !== null}><Plus size={19}/></button>
        </div>
        <p className="muted emom-entry-hint">Il valore parte dal target ({repsPerMinute} reps) e si ripristina per il minuto successivo. Correggilo con − / + solo quando serve.</p>
        <div className="form-grid">
          <button className="primary-button compact" onClick={() => recordMinute()} disabled={pausedAt !== null || complete}>REGISTRA {currentMinute} · {actualInput || '0'} REPS</button>
          <button className="secondary-button" onClick={() => recordMinute(true)} disabled={pausedAt !== null || complete}>SEGNA SALTATO</button>
        </div>
      </div>

      <div className="emom-previous">
        <div className="emom-previous-head"><div><strong>ULTIMA SESSIONE</strong><small>{priorSameLoad[0] ? new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short' }).format(new Date(priorSameLoad[0].startedAt)) + ' · stessa variante e zavorra' : 'Confronto sulla stessa variante e zavorra'}</small></div>{priorSameLoad[0] && <b>{priorSameLoad[0].minutes.reduce((sum, item) => sum + item.actualReps, 0)} reps</b>}</div>
        {priorSameLoad[0] ? <div className="emom-previous-minutes">{Array.from({ length: priorSameLoad[0].durationMinutes }, (_, i) => {
          const item = priorSameLoad[0].minutes.find(minute => minute.minute === i + 1)
          return <div className="emom-previous-minute" key={i}><small>M{i + 1}</small><strong>{item && !item.skipped ? item.actualReps : '—'}</strong></div>
        })}</div> : <p className="emom-previous-empty">Non hai ancora una seduta registrata con questa variante e questo carico. Al termine, qui troverai le ripetizioni minuto per minuto.</p>}
      </div>

      <div className="minute-log">
        <div className="minute-log-head"><strong>Questa sessione</strong><span>{minutes.filter(m => !m.skipped).length}/{duration} registrati · {totalLoggedReps} reps</span></div>
        <div className="minute-dots">{Array.from({ length: duration }, (_, i) => {
          const item = minutes.find(m => m.minute === i + 1)
          return <div key={i} className={'minute-result ' + (item ? (item.skipped ? 'missed' : item.completed ? 'done' : 'partial') : '')}>
            <small>M{i + 1}</small><strong>{item ? item.actualReps : '—'}</strong><span>{item ? 'effettive' : repsPerMinute + ' target'}</span>
          </div>
        })}</div>
      </div>

      <div className="form-grid">
        <button className="secondary-button" onClick={running ? pause : resume} disabled={complete}>{running ? 'PAUSA TIMER' : 'RIPRENDI TIMER'}</button>
        <button className="primary-button compact" onClick={() => void finish()} disabled={saving}>{saving ? 'SALVATAGGIO…' : complete ? 'SALVA SESSIONE' : 'TERMINA E SALVA'}</button>
      </div>
      {complete && <p className="muted">Tempo terminato. Controlla il riepilogo minuto per minuto, poi salva la sessione.</p>}
      <div className="form-grid"><label>RIR finale<input type="number" min="0" max="10" value={rir} onChange={e => setRir(Math.min(10, Math.max(0, Number(e.target.value) || 0)))} /></label><label>Tecnica<select value={technique} onChange={e => setTechnique(e.target.value as EmomLog['technique'])}><option value="good">Buona</option><option value="degraded">Degradata</option><option value="pain">Dolore</option></select></label></div>
      <label>Note<input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Sensazioni, recupero..." /></label>
      {suggestion && <div className="progression-hint emom-progression"><strong>Prossima progressione: {suggestion.title}</strong><span>{suggestion.reason}</span>{progressionChoice === 'accepted' || progressionChoice === 'kept' || progressionChoice === 'custom' ? <><span className="progression-saved-note">{progressionChoice === 'accepted' ? 'Proposta accettata' : progressionChoice === 'kept' ? 'Livello attuale mantenuto' : 'Valori personalizzati salvati'} per la prossima sessione di questa variante.</span><button type="button" className="text-action" onClick={() => { setNextPlanReps(suggestion.nextRepsPerMinute ?? repsPerMinute); setNextPlanLoad(suggestion.nextLoadKg ?? load); setProgressionChoice('editing') }}>MODIFICA PROSSIMO TARGET</button></> : null}{progressionChoice === 'editing' ? <><div className="form-grid"><label>Prossime reps/min<input type="number" min="1" max="100" value={nextPlanReps} onChange={event => setNextPlanReps(Math.min(100, Math.max(1, Number(event.target.value) || 1)))}/></label><label>Prossima zavorra<select value={nextPlanLoad} onChange={event => setNextPlanLoad(Number(event.target.value))}>{[0,5,10,15,20,25,30].map(value => <option key={value} value={value}>{value} kg</option>)}</select></label></div><button type="button" className="secondary-button" onClick={() => saveNextPlan('custom')}>SALVA PROSSIMO TARGET</button></> : null}{progressionChoice === null ? <div className="form-grid"><button type="button" className="secondary-button" onClick={() => saveNextPlan('accepted')}>ACCETTA</button><button type="button" className="secondary-button" onClick={() => saveNextPlan('kept')}>MANTIENI</button></div> : null}{progressionChoice === null ? <button type="button" className="text-action" onClick={() => { setNextPlanReps(suggestion.nextRepsPerMinute ?? repsPerMinute); setNextPlanLoad(suggestion.nextLoadKg ?? load); setProgressionChoice('editing') }}>MODIFICA PROPOSTA</button> : null}</div>}
      <p className="muted emom-resume-note">Sessione salvata automaticamente come bozza su questo dispositivo. Chiudendo la finestra potrai riprenderla dal punto in cui eri, con il tempo aggiornato.</p>
    </>}
  </div></div>
}
