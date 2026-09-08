import { useEffect, type ReactNode } from 'react'
import { initials } from '../../domain/names'

export function Section({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="mb-4">
      <div className="mb-2 flex items-end justify-between gap-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  )
}

export function Empty({ icon = '🪹', children }: { icon?: string; children: ReactNode }) {
  return (
    <div className="card px-4 py-10 text-center text-sm text-muted">
      <div className="mb-2 text-3xl">{icon}</div>
      {children}
    </div>
  )
}

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
      <div className="max-h-[88vh] w-full max-w-lg overflow-auto rounded-t-3xl border border-line bg-card p-4 sm:rounded-3xl">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-base font-bold">{title}</h3>
          <button className="btn px-2 py-1" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>
        <div className="text-sm">{children}</div>
        {footer && <div className="mt-4 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  )
}

/** Modal de confirmacao para acao que o admin nao deveria disparar sem querer. */
export function Confirm({
  open,
  title,
  confirmLabel,
  danger,
  onConfirm,
  onClose,
  children,
}: {
  open: boolean
  title: string
  confirmLabel: string
  danger?: boolean
  onConfirm: () => void
  onClose: () => void
  children: ReactNode
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button
            className={danger ? 'btn btn-danger' : 'btn btn-primary'}
            onClick={() => {
              onConfirm()
              onClose()
            }}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      {children}
    </Modal>
  )
}

export function Avatar({
  name,
  photoUrl,
  size = 34,
}: {
  name: string
  photoUrl?: string | null
  size?: number
}) {
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        width={size}
        height={size}
        className="shrink-0 rounded-full border border-line object-cover"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <div
      className="grid shrink-0 place-items-center rounded-full border border-line bg-card2 font-bold text-muted"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials(name)}
    </div>
  )
}

export function Seg<T extends string>({
  value,
  options,
  onChange,
  size = 'md',
}: {
  value: T
  options: Array<{ value: T; label: string; tone?: 'ok' | 'warn' | 'bad' }>
  onChange: (v: T) => void
  size?: 'sm' | 'md'
}) {
  const tones: Record<string, string> = {
    ok: 'bg-accent text-black border-transparent',
    warn: 'bg-gold text-black border-transparent',
    bad: 'bg-danger text-black border-transparent',
  }
  return (
    <div className="inline-flex overflow-hidden rounded-xl border border-line">
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={[
              size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm',
              'font-semibold transition',
              active ? tones[o.tone ?? 'ok'] ?? 'bg-accent text-black' : 'bg-card2 text-muted',
            ].join(' ')}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function Banner({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'danger'; children: ReactNode }) {
  const cls = {
    info: 'border-line bg-card2 text-muted',
    warn: 'border-gold/40 bg-gold/10 text-gold',
    danger: 'border-danger/40 bg-danger/10 text-danger',
  }[tone]
  return <div className={`mb-3 rounded-xl border px-3 py-2 text-xs ${cls}`}>{children}</div>
}
