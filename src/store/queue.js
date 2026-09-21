/**
 * The outbox.
 *
 * A mark is written to the device first and only cleared from the queue once
 * the database confirms it arrived. Sending happens by itself when a signal
 * comes back; a judge never presses a sync button.
 *
 * `sent` is stored as 0 or 1 rather than false or true, because IndexedDB
 * cannot index booleans.
 */

import { STORES, get, getUnsent, put, putMany } from './db.js'

export const SYNC_STATE = {
  IDLE: 'idle',
  SENDING: 'sending',
  OFFLINE: 'offline',
  FAILED: 'failed',
}

function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Record a mark.
 *
 * One record per criterion per judge per team, so re-marking a criterion
 * replaces rather than duplicates. The id is derived from those three things
 * for that reason.
 */
export function markId({ competitionId, judgeId, teamId, criterionId }) {
  return `${competitionId}|${judgeId}|${teamId}|${criterionId}`
}

export async function saveMark(mark) {
  const record = {
    id: markId(mark),
    competitionId: mark.competitionId,
    judgeId: mark.judgeId,
    teamId: mark.teamId,
    criterionId: mark.criterionId,
    value: mark.value,
    reason: mark.reason ?? '',
    // Kept so a mark that arrives late is still recorded in the right order.
    enteredAt: mark.enteredAt ?? new Date().toISOString(),
    sent: 0,
    attempts: 0,
    lastError: null,
  }
  await put(STORES.MARKS, record)
  return record
}

/** How many marks are still waiting to go. */
export async function pendingCount() {
  const unsent = await getUnsent()
  return unsent.length
}

/**
 * Try to send everything waiting.
 *
 * `transport` takes an array of marks and resolves only when the database has
 * confirmed them. Anything it does not confirm stays on the device.
 *
 * @param {(marks: object[]) => Promise<{accepted: string[]}>} transport
 */
export async function flush(transport, { onState } = {}) {
  const unsent = await getUnsent()
  if (unsent.length === 0) {
    onState?.({ state: SYNC_STATE.IDLE, pending: 0 })
    return { sent: 0, pending: 0 }
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    onState?.({ state: SYNC_STATE.OFFLINE, pending: unsent.length })
    return { sent: 0, pending: unsent.length }
  }

  onState?.({ state: SYNC_STATE.SENDING, pending: unsent.length })

  try {
    const { accepted } = await transport(unsent)
    const confirmed = new Set(accepted ?? [])

    // Only the ids the far end actually confirmed are cleared.
    const done = unsent
      .filter((m) => confirmed.has(m.id))
      .map((m) => ({ ...m, sent: 1, lastError: null }))

    if (done.length > 0) await putMany(STORES.MARKS, done)

    const stillWaiting = unsent.length - done.length
    if (stillWaiting > 0) {
      const retried = unsent
        .filter((m) => !confirmed.has(m.id))
        .map((m) => ({ ...m, attempts: (m.attempts ?? 0) + 1 }))
      await putMany(STORES.MARKS, retried)
    }

    onState?.({
      state: stillWaiting > 0 ? SYNC_STATE.FAILED : SYNC_STATE.IDLE,
      pending: stillWaiting,
    })
    return { sent: done.length, pending: stillWaiting }
  } catch (err) {
    // The send failed outright. Nothing is cleared, so nothing is lost.
    const retried = unsent.map((m) => ({
      ...m,
      attempts: (m.attempts ?? 0) + 1,
      lastError: String(err?.message ?? err),
    }))
    await putMany(STORES.MARKS, retried)
    onState?.({
      state: SYNC_STATE.FAILED,
      pending: unsent.length,
      error: String(err?.message ?? err),
    })
    return { sent: 0, pending: unsent.length, error: err }
  }
}

/**
 * Send whenever there is a connection, and stop when there is not.
 *
 * Returns a function that stops the watching.
 */
export function startAutoSync(transport, { onState, intervalMs = 15000 } = {}) {
  let stopped = false
  let running = false

  const tick = async () => {
    if (stopped || running) return
    running = true
    try {
      await flush(transport, { onState })
    } finally {
      running = false
    }
  }

  const timer = setInterval(tick, intervalMs)
  if (typeof window !== 'undefined') {
    window.addEventListener('online', tick)
    window.addEventListener('offline', () =>
      pendingCount().then((pending) =>
        onState?.({ state: SYNC_STATE.OFFLINE, pending }),
      ),
    )
  }
  tick()

  return () => {
    stopped = true
    clearInterval(timer)
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', tick)
    }
  }
}

/** The marks a judge has already given a team, for filling the form back in. */
export async function marksFor({ competitionId, judgeId, teamId }, criterionIds) {
  const out = {}
  for (const criterionId of criterionIds) {
    const record = await get(
      STORES.MARKS,
      markId({ competitionId, judgeId, teamId, criterionId }),
    )
    if (record) out[criterionId] = { value: record.value, reason: record.reason }
  }
  return out
}
