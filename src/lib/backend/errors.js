export class AppError extends Error {
  constructor(code, extra = {}) {
    super(code)
    this.code = code
    Object.assign(this, extra)
  }
}

// Maps Postgres exception text from the RPCs to AppError codes.
export function fromPg(error) {
  const msg = error?.message || ''
  const rl = msg.match(/rate_limited:(\d+)/)
  if (rl) return new AppError('rate_limited', { waitSec: Number(rl[1]) })
  for (const code of ['not_authenticated', 'profile_required', 'note_too_long', 'checkpoint_inactive']) {
    if (msg.includes(code)) return new AppError(code)
  }
  if (error?.code === '23505') return new AppError('username_taken')
  return new AppError('unknown', { cause: error })
}
