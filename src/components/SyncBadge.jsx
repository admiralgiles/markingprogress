import { SYNC_STATE } from '../store/queue.js'

/**
 * Where the judge stands.
 *
 * The one thing on screen at all times, because at the end of the day
 * someone needs to be able to spot a judge still holding unsent marks.
 */
export default function SyncBadge({ state, pending, error }) {
  const label = () => {
    if (state === SYNC_STATE.SENDING) return 'Sending…'
    if (state === SYNC_STATE.OFFLINE) {
      return pending === 0
        ? 'No signal'
        : `No signal, ${pending} ${pending === 1 ? 'mark' : 'marks'} held`
    }
    if (state === SYNC_STATE.FAILED) {
      return `${pending} ${pending === 1 ? 'mark' : 'marks'} waiting to send`
    }
    if (pending > 0) {
      return `${pending} ${pending === 1 ? 'mark' : 'marks'} waiting to send`
    }
    return 'All marks sent'
  }

  const tone =
    pending === 0 && state === SYNC_STATE.IDLE
      ? 'ok'
      : state === SYNC_STATE.SENDING
        ? 'busy'
        : 'holding'

  return (
    <span className={`sync sync-${tone}`} title={error ?? undefined}>
      <span className="sync-dot" aria-hidden="true" />
      {label()}
    </span>
  )
}
