import { useLiveQuery } from 'dexie-react-hooks'
import { Activity, CalendarDays, ChartNoAxesCombined, Dumbbell, History, Timer, Pencil, Trash2, Play, Pause, Square, ChevronRight } from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { db } from './database/db'
import EmomRunner from './features/emom/EmomRunner'
import WorkoutLogger from './features/workout/WorkoutLogger'
import DataManagement from './features/data/DataManagement'
import RecoveryAdvisor from './features/recovery/RecoveryAdvisor'
import PlanEditor from './features/plan/PlanEditor'
import { EXERCISES, TRAINING_WEEK, VALID_LOADS_KG, prescriptionSummary, prescriptionNotes, prescriptionForWeek, type CycleWeek, type Prescription } from './data/program'
import { getStrengthPlanOverride } from './domain/strengthPlanOverrides'
import { getEmomPlanOverride } from './domain/emomPlanOverrides'
import type { EmomLog, ExerciseId, SetLog, TrainingSession, WorkoutLog } from './types'

type Tab = 'today' | 'plan' | 'history' | 'progress'
const ProgressDashboard = lazy(() => import('./features/progress/ProgressDashboard'))
const tabs: { id: Tab; label: string; icon: typeof Activity }[] = [
  { id: 'today', label: 'Oggi', icon: Activity }, { id: 'plan', label: 'Scheda', icon: CalendarDays },
  { id: 'history', label: 'Storico', icon: History }, { id: 'progress', label: 'Progressi', icon: ChartNoAxesCombined },
]
const ACTIVE_WORKOUT_KEY = 'calisthenics-coach-v2:active-training-session:v1'
interface ActiveWorkoutTimer { id: string; startedAt: number; pausedAt: number | null; pausedMs: number }
function readActiveWorkoutTimer(): ActiveWorkoutTimer | null {
  try {
    const raw = localStorage.getItem(ACTIVE_WORKOUT_KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<ActiveWorkoutTimer>
    if (typeof value.id !== 'string' || typeof value.startedAt !== 'number' || !Number.isFinite(value.startedAt) || typeof value.pausedMs !== 'number' || !(value.pausedAt === null || typeof value.pausedAt === 'number')) return null
    if (Date.now() - value.startedAt > 18 * 60 * 60 * 1000 || value.startedAt > Date.now()) { localStorage.removeItem(ACTIVE_WORKOUT_KEY); return null }
    return value as ActiveWorkoutTimer
  } catch { return null }
}
function formatStopwatch(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return h > 0 ? [h, m, s].map(value => String(value).padStart(2, '0')).join(':') : [m, s].map(value => String(value).padStart(2, '0')).join(':')
}
function formatDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remaining = seconds % 60
  if (hours) return `${hours} h ${minutes} min`
  if (minutes) return `${minutes} min ${remaining} s`
  return `${remaining} s`
}
function localDateKey(date = new Date()) {
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0')
}

function withSavedProgression(prescription: Prescription): Prescription {
  if (prescription.durationMinutes !== undefined) {
    const override = getEmomPlanOverride(prescription.exerciseId, prescription.variation)
    return override ? {
      ...prescription,
      durationMinutes: override.duration,
      repsPerMinute: override.repsPerMinute,
      addedLoadKg: override.load,
    } : prescription
  }
  const override = getStrengthPlanOverride(prescription.exerciseId, prescription.variation)
  return override ? {
    ...prescription,
    sets: override.sets ?? prescription.sets,
    reps: override.targetReps,
    addedLoadKg: override.addedLoadKg,
  } : prescription
}

export default function App() {
  const today = TRAINING_WEEK[(new Date().getDay() + 6) % 7]
  const [tab, setTab] = useState<Tab>('today')
  const [planRevision, setPlanRevision] = useState(0)
  const [activeWorkoutTimer, setActiveWorkoutTimer] = useState<ActiveWorkoutTimer | null>(() => readActiveWorkoutTimer())
  const [sessionClockNow, setSessionClockNow] = useState(Date.now())
  const [cycleWeek, setCycleWeek] = useState<CycleWeek>(() => {
    try { const value = Number(localStorage.getItem('calisthenics-coach-v2:cycle-week')); return [1, 2, 3, 4].includes(value) ? value as CycleWeek : 1 } catch { return 1 }
  })
  const [showQuickLog, setShowQuickLog] = useState(false)
  const [showEmom, setShowEmom] = useState(false)
  const [emomPreset, setEmomPreset] = useState<{ exerciseId: ExerciseId; variation: string; duration: number; repsPerMinute: number; load: number } | null>(null)
  const [editing, setEditing] = useState<WorkoutLog | null>(null)
  const [editingOriginalDate, setEditingOriginalDate] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const workouts = useLiveQuery(() => db.workouts.orderBy('date').reverse().toArray(), []) ?? []
  const totalSessions = useLiveQuery(() => db.workouts.count(), []) ?? 0
  const trainingSessions = useLiveQuery(() => db.trainingSessions.orderBy('startedAt').reverse().toArray(), []) ?? []
  const todayKey = localDateKey()
  const oldestIncludedDate = new Date(); oldestIncludedDate.setHours(12, 0, 0, 0); oldestIncludedDate.setDate(oldestIncludedDate.getDate() - 6)
  const oldestIncludedKey = localDateKey(oldestIncludedDate)
  const weeklyCount = useMemo(() => workouts.filter(w => w.date >= oldestIncludedKey && w.date <= todayKey).length, [workouts, oldestIncludedKey, todayKey])
  const activeTodayPrescriptions = useMemo(() => cycleWeek === 4 ? today.prescriptions.filter(p => !p.optional) : today.prescriptions, [cycleWeek, today.id, planRevision])

  useEffect(() => {
    try {
      if (activeWorkoutTimer) localStorage.setItem(ACTIVE_WORKOUT_KEY, JSON.stringify(activeWorkoutTimer))
      else localStorage.removeItem(ACTIVE_WORKOUT_KEY)
    } catch {}
  }, [activeWorkoutTimer])

  useEffect(() => {
    if (!activeWorkoutTimer || activeWorkoutTimer.pausedAt !== null) return
    const interval = window.setInterval(() => setSessionClockNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [activeWorkoutTimer])

  const startWorkoutTimer = () => {
    if (activeWorkoutTimer) return
    const startedAt = Date.now()
    const next: ActiveWorkoutTimer = { id: crypto.randomUUID(), startedAt, pausedAt: null, pausedMs: 0 }
    try { localStorage.setItem(ACTIVE_WORKOUT_KEY, JSON.stringify(next)) } catch {}
    setSessionClockNow(startedAt)
    setActiveWorkoutTimer(next)
  }

  const toggleWorkoutPause = () => {
    if (!activeWorkoutTimer) return
    const timestamp = Date.now()
    if (activeWorkoutTimer.pausedAt === null) {
      setActiveWorkoutTimer({ ...activeWorkoutTimer, pausedAt: timestamp })
    } else {
      setActiveWorkoutTimer({ ...activeWorkoutTimer, pausedMs: activeWorkoutTimer.pausedMs + timestamp - activeWorkoutTimer.pausedAt, pausedAt: null })
    }
    setSessionClockNow(timestamp)
  }

  const finishWorkoutTimer = async () => {
    if (!activeWorkoutTimer) return
    const endedAt = Date.now()
    const pausedForCurrentBreak = activeWorkoutTimer.pausedAt === null ? 0 : endedAt - activeWorkoutTimer.pausedAt
    const durationSeconds = Math.max(0, Math.floor((endedAt - activeWorkoutTimer.startedAt - activeWorkoutTimer.pausedMs - pausedForCurrentBreak) / 1000))
    const completedWorkouts = (await db.workouts.toArray()).filter(workout =>
      workout.completedAt !== null && workout.completedAt >= activeWorkoutTimer.startedAt && workout.completedAt <= endedAt
    )
    const session: TrainingSession = {
      id: activeWorkoutTimer.id,
      date: localDateKey(new Date(activeWorkoutTimer.startedAt)),
      startedAt: activeWorkoutTimer.startedAt,
      endedAt,
      durationSeconds,
      loggedEntries: completedWorkouts.reduce((sum, workout) => sum + workout.setLogs.length + workout.emomLogs.length, 0),
      totalReps: completedWorkouts.reduce((sum, workout) =>
        sum + workout.setLogs.reduce((count, set) => count + set.actualReps, 0) +
        workout.emomLogs.reduce((count, emom) => count + emom.minutes.reduce((minuteCount, minute) => minuteCount + minute.actualReps, 0), 0), 0),
    }
    await db.trainingSessions.put(session)
    setSessionClockNow(endedAt)
    setActiveWorkoutTimer(null)
  }

  const elapsedWorkoutSeconds = activeWorkoutTimer
    ? Math.floor(Math.max(0, (activeWorkoutTimer.pausedAt ?? sessionClockNow) - activeWorkoutTimer.startedAt - activeWorkoutTimer.pausedMs) / 1000)
    : 0

  const saveEdit = async () => {
    if (!editing) return
    const originalDate = editingOriginalDate ?? editing.date
    const rebase = (timestamp: number | null) => {
      if (timestamp === null || editing.date === originalDate) return timestamp
      const time = new Date(timestamp)
      const [year, month, day] = editing.date.split('-').map(Number)
      time.setFullYear(year, month - 1, day)
      return time.getTime()
    }
    const updated: WorkoutLog = {
      ...editing,
      emomLogs: editing.emomLogs.map(log => ({
        ...log,
        startedAt: rebase(log.startedAt) ?? log.startedAt,
        endedAt: rebase(log.endedAt),
        pausedAt: rebase(log.pausedAt),
      })),
    }
    await db.transaction('rw', db.workouts, db.emoms, async () => {
      await db.workouts.put(updated)
      if (updated.emomLogs.length) await db.emoms.bulkPut(updated.emomLogs)
    })
    setEditing(null)
    setEditingOriginalDate(null)
  }
  const deleteWorkout = async () => { if (!deleteId) return; const workout = await db.workouts.get(deleteId); await db.transaction('rw', db.workouts, db.emoms, async () => { if (workout) for (const emom of workout.emomLogs) await db.emoms.delete(emom.id); await db.workouts.delete(deleteId) }); setDeleteId(null) }
  return <div className="app-shell">
    <header className="topbar"><div className="brand-mark">C<span>.</span></div><div className="brand-copy"><strong>CALISTHENICS COACH</strong><small>PERSONAL TRAINING SYSTEM</small></div></header>
    <main className="main-content">
      {tab === 'today' && <section>
        <div className="eyebrow">{new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()).toUpperCase()}</div>
        <div className="hero-row"><div><h1>Allenati con<br/><span>intenzione.</span></h1><p className="muted">Costanza, tecnica, progressione.</p></div><div className="hero-icon"><Dumbbell size={25}/></div></div>
        <div className="stats-grid"><Stat label="SESSIONI TOTALI" value={totalSessions.toString().padStart(2,'0')}/><Stat label="ULTIMI 7 GIORNI" value={weeklyCount.toString().padStart(2,'0')}/><Stat label="CICLO" value={String(cycleWeek).padStart(2, '0') + " / 04"}/></div>
        <RecoveryAdvisor workouts={workouts} />
        <div className="section-heading"><div><div className="eyebrow">PROGRAMMA</div><h2>{today.label} <span className="muted">/ {today.focus}</span></h2></div><span className="tag">{cycleWeek === 4 ? "DELOAD · SETTIMANA 4" : "CARICO · SETTIMANA " + cycleWeek}</span></div>
        {activeTodayPrescriptions.length ? <div className="exercise-list">{(cycleWeek === 4 ? today.prescriptions.filter(p => !p.optional) : today.prescriptions).map((p,i)=>{const effective=withSavedProgression(p);return <article className="exercise-card" key={today.id+i}><div className="exercise-index">{String(i+1).padStart(2,'0')}</div><div className="exercise-info"><strong>{p.title}</strong><span>{prescriptionSummary(effective, cycleWeek)}</span>{p.notes && <small className="plan-notes">{prescriptionNotes(effective, cycleWeek)}</small>}</div><span className="exercise-arrow">↗</span></article>})}</div> : <div className="rest-card"><span>RECUPERO PROGRAMMATO</span><h3>Oggi si recupera.</h3><p>Il recupero fa parte della progressione.</p></div>}
        <section className="workout-session-panel">
          {activeWorkoutTimer ? <div className="workout-session-live">
            <div className="workout-session-heading"><div><span className="eyebrow">SESSIONE IN CORSO</span><p>{activeWorkoutTimer.pausedAt === null ? 'Il cronometro è attivo' : 'Cronometro in pausa'}</p></div><span className={activeWorkoutTimer.pausedAt === null ? 'session-status active' : 'session-status'}>{activeWorkoutTimer.pausedAt === null ? 'ATTIVA' : 'IN PAUSA'}</span></div>
            <div className="workout-stopwatch"><Timer size={22}/><strong>{formatStopwatch(elapsedWorkoutSeconds)}</strong></div>
            <div className="workout-session-controls">
              <button className="secondary-button" type="button" onClick={toggleWorkoutPause}>{activeWorkoutTimer.pausedAt === null ? <Pause size={16}/> : <Play size={16}/>} {activeWorkoutTimer.pausedAt === null ? 'METTI IN PAUSA' : 'RIPRENDI'}</button>
              <button className="finish-session-button" type="button" onClick={() => void finishWorkoutTimer()}><Square size={15}/> TERMINA E SALVA</button>
            </div>
          </div> : <div className="workout-session-start">
            <div className="workout-session-heading"><div><span className="eyebrow">CRONOMETRO ALLENAMENTO</span><h3>Pronto a iniziare?</h3><p>Avvia il timer prima della prima serie. Il tempo continuerà anche mentre registri gli esercizi.</p></div></div>
            <button className="primary-button workout-start-button" type="button" onClick={startWorkoutTimer}><Play size={18}/> INIZIA ALLENAMENTO</button>
          </div>}
          <div className="session-tools-heading"><span>STRUMENTI DELLA SESSIONE</span><small>Le registrazioni avviano il timer se non è già attivo</small></div>
          <div className="session-tool-list">
            <button className="session-tool" type="button" onClick={() => { startWorkoutTimer(); setShowQuickLog(true) }}>
              <span className="session-tool-icon"><Dumbbell size={19}/></span><span className="session-tool-copy"><strong>Registra serie</strong><small>Ripetizioni, zavorra, RIR e tecnica</small></span><ChevronRight size={17} className="session-tool-arrow"/>
            </button>
            {activeTodayPrescriptions.filter(p => p.durationMinutes !== undefined).map((p, i) => {
              const scaled = prescriptionForWeek(withSavedProgression(p), cycleWeek)
              return <button className="session-tool" type="button" key={today.id + '-emom-' + i} onClick={() => { startWorkoutTimer(); setEmomPreset({ exerciseId: p.exerciseId, variation: p.variation, duration: scaled.durationMinutes ?? 10, repsPerMinute: scaled.repsPerMinute ?? 6, load: scaled.addedLoadKg }); setShowEmom(true) }}>
                <span className="session-tool-icon"><Timer size={19}/></span><span className="session-tool-copy"><strong>EMOM programmato · {p.title.replace(/ EMOM.*/i, '').replace(/ EMOM/i, '')}</strong><small>{scaled.durationMinutes ?? 10} min × {scaled.repsPerMinute ?? 6} rep/min · {scaled.addedLoadKg} kg</small></span><ChevronRight size={17} className="session-tool-arrow"/>
              </button>
            })}
            <button className="session-tool" type="button" onClick={() => { startWorkoutTimer(); setEmomPreset(null); setShowEmom(true) }}>
              <span className="session-tool-icon"><Timer size={19}/></span><span className="session-tool-copy"><strong>EMOM personalizzato</strong><small>Scegli esercizio, durata, reps e zavorra</small></span><ChevronRight size={17} className="session-tool-arrow"/>
            </button>
          </div>
          {!activeWorkoutTimer && trainingSessions[0] && <div className="last-session-summary"><div><span>ULTIMO ALLENAMENTO</span><small>{new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(trainingSessions[0].startedAt))} · {trainingSessions[0].loggedEntries} elementi registrati</small></div><strong>{formatDuration(trainingSessions[0].durationSeconds)}</strong></div>}
        </section>
      </section>}
      {tab === 'plan' && <section><div className="eyebrow">IL TUO SISTEMA</div><h1>La scheda<span>.</span></h1><p className="muted">3 settimane di carico + 1 settimana di deload. La selezione viene salvata su questo dispositivo.</p><div className="cycle-selector" aria-label="Settimana del ciclo">{([1,2,3,4] as CycleWeek[]).map(week=><button key={week} type="button" className={cycleWeek===week?'selected':''} onClick={()=>{setCycleWeek(week);try{localStorage.setItem('calisthenics-coach-v2:cycle-week',String(week))}catch{}}}><small>SETTIMANA</small><strong>{String(week).padStart(2,'0')}</strong><span>{week===4?'DELOAD':'CARICO'}</span></button>)}</div>{cycleWeek===4 && <div className="deload-banner"><strong>Settimana di scarico attiva</strong><span>Volume ridotto circa del 40%, carico ridotto ove possibile e niente drop set, cedimento o circuiti massimali. Le registrazioni non vengono modificate automaticamente.</span></div>}{TRAINING_WEEK.map(day => <PlanEditor key={day.id} day={day} cycleWeek={cycleWeek} onSaved={() => setPlanRevision(value => value + 1)} />)}</section>}
      {tab === 'history' && <section><div className="eyebrow">DATABASE PERSONALE</div><h1>Storico<span>.</span></h1>{trainingSessions.length > 0 && <><div className="session-history-heading"><div><div className="eyebrow">CRONOMETRO</div><h2>Allenamenti completati</h2></div></div><div className="session-history-list">{trainingSessions.slice(0, 8).map(session => <article className="session-history-card" key={session.id}><div><strong>{new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(session.startedAt))}</strong><small>{new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' }).format(new Date(session.startedAt))}–{new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' }).format(new Date(session.endedAt))} · {session.loggedEntries} elementi · {session.totalReps} reps</small></div><b>{formatDuration(session.durationSeconds)}</b></article>)}</div></>}{workouts.length ? workouts.map(w=><article className="history-card history-card-edit" key={w.id}><div className="history-main"><strong>{w.title}</strong><small>{w.date} · {w.setLogs.length} serie · {w.emomLogs.length} EMOM</small><small>{w.notes || 'Nessuna nota'}</small></div><span>{w.setLogs.reduce((n,s)=>n+s.actualReps,0)+w.emomLogs.reduce((n,e)=>n+e.minutes.reduce((a,m)=>a+m.actualReps,0),0)} reps</span><button className="icon-button" aria-label="Modifica" onClick={()=>{setEditingOriginalDate(w.date);setEditing(structuredClone(w))}}><Pencil size={16}/></button><button className="icon-button danger" aria-label="Elimina" onClick={()=>setDeleteId(w.id)}><Trash2 size={16}/></button></article>) : <div className="empty-state">Le tue sessioni appariranno qui, una volta registrate.</div>}<DataManagement workouts={workouts} onRestored={()=>{try{const value=Number(localStorage.getItem('calisthenics-coach-v2:cycle-week'));setCycleWeek([1,2,3,4].includes(value)?value as CycleWeek:1)}catch{setCycleWeek(1)}}}/></section>}
      {tab === 'progress' && <section><div className="eyebrow">DATI, NON SENSAZIONI</div><h1>Progressi<span>.</span></h1><Suspense fallback={<div className="empty-state">Caricamento delle analisi…</div>}><ProgressDashboard workouts={workouts}/></Suspense></section>}
    </main>
    <nav className="bottom-nav">{tabs.map(({id,label,icon:Icon})=><button key={id} className={tab===id?'nav-item active':'nav-item'} onClick={()=>setTab(id)}><Icon size={19}/><span>{label}</span></button>)}</nav>
    {showEmom && <EmomRunner onClose={()=>{setShowEmom(false);setEmomPreset(null)}} initialConfig={emomPreset ?? undefined} progressionEnabled={cycleWeek !== 4}/>}
    {editing && <WorkoutEditor workout={editing} onChange={setEditing} onClose={()=>{setEditing(null);setEditingOriginalDate(null)}} onSave={()=>void saveEdit()}/>}
    {deleteId && <div className="modal-backdrop"><div className="modal"><div className="modal-head"><h2>Eliminare la sessione?</h2><button className="close-button" onClick={()=>setDeleteId(null)}>×</button></div><p className="muted">Questa azione non può essere annullata.</p><div className="form-grid"><button className="secondary-button" onClick={()=>setDeleteId(null)}>ANNULLA</button><button className="primary-button" onClick={()=>void deleteWorkout()}>ELIMINA</button></div></div></div>}
    {showQuickLog && <WorkoutLogger workouts={workouts} dayLabel={today.label} prescriptions={activeTodayPrescriptions.map(p => prescriptionForWeek(withSavedProgression(p), cycleWeek))} progressionEnabled={cycleWeek !== 4} onClose={()=>setShowQuickLog(false)} onSave={async entry=>{await db.workouts.add(entry)}}/>}
  </div>
}

function WorkoutEditor({workout,onChange,onClose,onSave}:{workout:WorkoutLog;onChange:(w:WorkoutLog)=>void;onClose:()=>void;onSave:()=>void}) {
  const originalSnapshot = useRef(JSON.stringify(workout))
  const requestClose = () => {
    if (JSON.stringify(workout) !== originalSnapshot.current &&
      !window.confirm('Annullare le modifiche non salvate a questa sessione?')) return
    onClose()
  }
  const patch=(id:string,values:Partial<SetLog>)=>onChange({...workout,setLogs:workout.setLogs.map(s=>s.id===id?{...s,...values,completed:values.completed ?? (values.actualReps!==undefined ? true : s.completed)}:s)})
  const patchEmom=(id:string,values:Partial<EmomLog>)=>onChange({...workout,emomLogs:workout.emomLogs.map(log=>log.id===id?{...log,...values}:log)})
  const patchMinute=(emomId:string,minute:number,values:Partial<EmomLog['minutes'][number]>)=>onChange({
    ...workout,
    emomLogs:workout.emomLogs.map(log=>log.id!==emomId?log:{
      ...log,
      minutes:log.minutes.map(item=>{
        if(item.minute!==minute)return item
        const next={...item,...values}
        return {...next,completed:!next.skipped&&next.actualReps>=next.targetReps}
      }),
    }),
  })
  return <div className="modal-backdrop" onClick={requestClose}><div className="modal editor-modal" onClick={e=>e.stopPropagation()}>
    <div className="modal-head"><div><div className="eyebrow">MODIFICA REGISTRAZIONE</div><h2>{workout.title}</h2></div><button className="close-button" onClick={requestClose}>×</button></div>
    <label>Titolo<input value={workout.title} onChange={e=>onChange({...workout,title:e.target.value})}/></label>
    <label>Data<input type="date" value={workout.date} onChange={e=>onChange({...workout,date:e.target.value})}/></label>
    {workout.setLogs.length > 0 && <>
      <div className="editor-section-title">SERIE <button className="secondary-button" onClick={()=>onChange({...workout,setLogs:[...workout.setLogs,{id:crypto.randomUUID(),exerciseId:'pull-up',variation:'Strict',addedLoadKg:0,targetReps:6,actualReps:0,rir:2,completed:false,technique:'good',notes:'',createdAt:Date.now()}]})}>+ AGGIUNGI SERIE</button></div>
      {workout.setLogs.map((s,i)=><div className="set-editor" key={s.id}><div className="plan-day-head"><strong>Serie {i+1}</strong><button className="icon-button danger" onClick={()=>onChange({...workout,setLogs:workout.setLogs.filter(x=>x.id!==s.id)})}><Trash2 size={15}/></button></div>
        <label>Esercizio<select value={s.exerciseId} onChange={e=>patch(s.id,{exerciseId:e.target.value as ExerciseId})}>{EXERCISES.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
        <label>Variante<input value={s.variation} onChange={e=>patch(s.id,{variation:e.target.value})}/></label>
        <div className="form-grid"><label>Target<input type="number" min="0" value={s.targetReps} onChange={e=>patch(s.id,{targetReps:Math.max(0,Number(e.target.value))})}/></label><label>Effettive<input type="number" min="0" value={s.actualReps} onChange={e=>patch(s.id,{actualReps:Math.max(0,Number(e.target.value))})}/></label></div>
        <div className="form-grid"><label>Zavorra<select value={s.addedLoadKg} onChange={e=>patch(s.id,{addedLoadKg:Number(e.target.value)})}>{VALID_LOADS_KG.map(v=><option key={v} value={v}>{v} kg</option>)}</select></label><label>RIR<input type="number" min="0" max="10" value={s.rir ?? ''} onChange={e=>patch(s.id,{rir:e.target.value===''?null:Number(e.target.value)})}/></label></div>
        <label>Tecnica<select value={s.technique} onChange={e=>patch(s.id,{technique:e.target.value as SetLog['technique']})}><option value="good">Buona</option><option value="degraded">Degradata</option><option value="pain">Dolore</option></select></label><label className="check-label"><input type="checkbox" checked={s.completed} onChange={e=>patch(s.id,{completed:e.target.checked})}/> Completata</label><label>Note<input value={s.notes} onChange={e=>patch(s.id,{notes:e.target.value})}/></label>
      </div>)}
    </>}
    {workout.emomLogs.length > 0 && <>
      <div className="editor-section-title">REGISTRAZIONI EMOM</div>
      {workout.emomLogs.map(log=><div className="set-editor emom-editor" key={log.id}>
        <div className="logger-set-head"><strong>{EXERCISES.find(item=>item.id===log.exerciseId)?.name ?? log.exerciseId} · {log.durationMinutes} min</strong><span>{log.minutes.reduce((n,m)=>n+m.actualReps,0)} reps</span></div>
        <label>Variante<input value={log.variation} onChange={e=>patchEmom(log.id,{variation:e.target.value})}/></label>
        <div className="form-grid"><label>Zavorra<select value={log.addedLoadKg} onChange={e=>patchEmom(log.id,{addedLoadKg:Number(e.target.value)})}>{VALID_LOADS_KG.map(v=><option key={v} value={v}>{v} kg</option>)}</select></label><label>RIR finale<input type="number" min="0" max="10" value={log.rir ?? ''} onChange={e=>patchEmom(log.id,{rir:e.target.value===''?null:Number(e.target.value)})}/></label></div>
        <label>Tecnica<select value={log.technique} onChange={e=>patchEmom(log.id,{technique:e.target.value as EmomLog['technique']})}><option value="good">Buona</option><option value="degraded">Degradata</option><option value="pain">Dolore</option></select></label>
        <label>Note EMOM<input value={log.notes} onChange={e=>patchEmom(log.id,{notes:e.target.value})}/></label>
        <div className="emom-edit-minutes">{log.minutes.slice().sort((a,b)=>a.minute-b.minute).map(minute=><div className="emom-edit-minute" key={minute.minute}>
          <strong>Minuto {minute.minute}</strong>
          <div className="form-grid"><label>Target<input type="number" min="0" value={minute.targetReps} onChange={e=>patchMinute(log.id,minute.minute,{targetReps:Math.max(0,Number(e.target.value))})}/></label><label>Effettive<input type="number" min="0" value={minute.actualReps} onChange={e=>patchMinute(log.id,minute.minute,{actualReps:Math.max(0,Number(e.target.value))})}/></label></div>
          <label className="check-label"><input type="checkbox" checked={minute.skipped} onChange={e=>patchMinute(log.id,minute.minute,{skipped:e.target.checked})}/> Minuto saltato</label>
          <small className="muted">{minute.completed?'Target raggiunto':minute.skipped?'Saltato':'Parziale / sotto target'}</small>
        </div>)}</div>
      </div>)}
    </>}
    <label>Note sessione<input value={workout.notes} onChange={e=>onChange({...workout,notes:e.target.value})}/></label><label>Dolore / fastidi<input value={workout.pain} onChange={e=>onChange({...workout,pain:e.target.value})}/></label>
    <button className="primary-button full" onClick={onSave}>SALVA MODIFICHE</button>
  </div></div>
}

function Stat({label,value}:{label:string;value:string}) { return <div className="stat-card"><small>{label}</small><strong>{value}</strong></div> }
