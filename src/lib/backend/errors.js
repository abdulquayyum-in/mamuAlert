export class AppError extends Error {
  constructor(code, extra = {}) {
    super(code)
    this.code = code
    Object.assign(this, extra)
  }
}

// "busy": the backend is refusing or overloaded (rate limits, connection caps,
// timeouts). "offline": the request never reached it.
const OFFLINE = /failed to fetch|networkerror|load failed|network request failed/i
const BUSY_PG = new Set(['53300', '57014', 'PGRST000', 'PGRST001', 'PGRST002', 'PGRST003'])

export function fromAuth(error) {
  const msg = error?.message || ''
  if (error?.status === 429 || error?.code === 'over_request_rate_limit') return new AppError('busy', { cause: error })
  if (OFFLINE.test(msg) || error?.name === 'AuthRetryableFetchError') return new AppError('offline', { cause: error })
  if (error?.status >= 500) return new AppError('busy', { cause: error })
  return new AppError('auth_failed', { cause: error })
}

// Maps Postgres exception text from the RPCs to AppError codes.
export function fromPg(error) {
  const msg = error?.message || ''
  if (OFFLINE.test(msg)) return new AppError('offline', { cause: error })
  if (BUSY_PG.has(error?.code) || /too many (connections|requests)/i.test(msg)) return new AppError('busy', { cause: error })
  const rl = msg.match(/rate_limited:(\d+)/)
  if (rl) return new AppError('rate_limited', { waitSec: Number(rl[1]) })
  for (const code of ['not_authenticated', 'profile_required', 'note_too_long', 'checkpoint_inactive']) {
    if (msg.includes(code)) return new AppError(code)
  }
  if (error?.code === '23505') return new AppError('username_taken')
  return new AppError('unknown', { cause: error })
}
