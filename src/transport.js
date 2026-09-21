/**
 * Sending marks to the database.
 *
 * There is no database yet, so this is a stand-in that behaves like one: it
 * takes a while, it confirms by id, and it can be made to fail so the queue
 * and the status badge can be seen doing their job.
 *
 * When Supabase goes in, only this file changes. Everything upstream already
 * treats "sent" as meaning "the far end confirmed this id".
 */

const LATENCY_MS = 700

export const stubTransport = {
  /** Flipped by the toggle in the header, to imitate losing signal. */
  failing: false,

  async send(marks) {
    await new Promise((r) => setTimeout(r, LATENCY_MS))

    if (stubTransport.failing) {
      throw new Error('No connection to the database')
    }

    // A real backend confirms each id it has written. Anything it leaves out
    // stays on the device and is tried again.
    return { accepted: marks.map((m) => m.id) }
  },
}

export const send = (marks) => stubTransport.send(marks)
