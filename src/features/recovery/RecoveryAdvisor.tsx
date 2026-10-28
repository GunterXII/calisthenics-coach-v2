import { AlertTriangle, Moon, TrendingDown } from 'lucide-react'
import { getRecoveryAlerts } from '../../domain/recovery'
import type { WorkoutLog } from '../../types'

export default function RecoveryAdvisor({ workouts }: { workouts: WorkoutLog[] }) {
  const alerts = getRecoveryAlerts(workouts)
  if (!alerts.length) return null

  const iconFor = (id: string) => id === 'sleep' ? Moon : id === 'decline' ? TrendingDown : AlertTriangle
  return <section className="recovery-advisor" aria-label="Avvisi di recupero">
    <div className="recovery-advisor-head"><span>RECUPERO</span><strong>{alerts.length} {alerts.length === 1 ? 'avviso' : 'avvisi'}</strong></div>
    {alerts.map(alert => {
      const Icon = iconFor(alert.id)
      return <article className="recovery-alert" key={alert.id}>
        <Icon size={17} aria-hidden="true" />
        <div><strong>{alert.title}</strong><p>{alert.detail}</p></div>
      </article>
    })}
  </section>
}
