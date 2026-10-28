import { useRef, useState } from 'react'
import { Download, FileUp, FileSpreadsheet, ShieldCheck } from 'lucide-react'
import { createBackup, downloadText, parseBackup, restoreBackup, workoutRowsCsv } from '../../domain/backup'
import type { WorkoutLog } from '../../types'

export default function DataManagement({ workouts }: { workouts: WorkoutLog[] }) {
  const input = useRef<HTMLInputElement>(null)
  const [busy,setBusy] = useState(false)
  const [message,setMessage] = useState('')
  const exportJson = async () => {
    setBusy(true); setMessage('')
    try {
      const backup = await createBackup()
      const stamp = new Date().toISOString().slice(0,10)
      downloadText(`calisthenics-coach-backup-${stamp}.json`, JSON.stringify(backup,null,2), 'application/json')
      setMessage(`Backup creato: ${backup.data.workouts.length} sessioni, ${backup.data.emoms.length} EMOM, ${backup.data.records.length} test.`)
    } catch { setMessage('Esportazione non riuscita. Riprova.') }
    finally { setBusy(false) }
  }
  const exportCsv = () => {
    downloadText(`calisthenics-coach-sessioni-${new Date().toISOString().slice(0,10)}.csv`, workoutRowsCsv(workouts), 'text/csv;charset=utf-8')
    setMessage('CSV delle serie esportato.')
  }
  const importJson = async (file?: File) => {
    if (!file) return
    setBusy(true); setMessage('')
    try {
      const parsed = parseBackup(JSON.parse(await file.text()))
      const counts = parsed.data
      const confirmed = window.confirm(
        `Ripristinare questo backup del ${new Date(parsed.exportedAt).toLocaleString('it-IT')}?\n\n${counts.workouts.length} sessioni · ${counts.emoms.length} EMOM · ${counts.records.length} test\n\nATTENZIONE: i dati attualmente presenti su questo dispositivo verranno sostituiti integralmente.`
      )
      if (!confirmed) return
      await restoreBackup(parsed)
      setMessage('Ripristino completato. I dati sono stati sostituiti dal backup.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'File non valido: ripristino annullato.')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }
  return <section className="data-management">
    <div className="eyebrow">SICUREZZA DEI DATI</div><h2>Backup e ripristino</h2>
    <p>Gli allenamenti sono salvati su questo dispositivo. Esporta regolarmente una copia JSON per conservarli o trasferirli su un altro dispositivo.</p>
    <div className="backup-actions">
      <button className="secondary-button" disabled={busy} onClick={()=>void exportJson()}><Download size={15}/> ESPORTA BACKUP JSON</button>
      <button className="secondary-button" disabled={busy} onClick={()=>input.current?.click()}><FileUp size={15}/> RIPRISTINA DA JSON</button>
      <button className="secondary-button" onClick={exportCsv}><FileSpreadsheet size={15}/> ESPORTA SERIE CSV</button>
    </div>
    <input ref={input} type="file" accept="application/json,.json" hidden onChange={e=>void importJson(e.target.files?.[0])}/>
    <div className="backup-note"><ShieldCheck size={16}/><span>Il ripristino sostituisce tutti i dati locali. Il file viene controllato prima di modificare il database.</span></div>
    {message && <div className="backup-message" role="status">{message}</div>}
  </section>
}
