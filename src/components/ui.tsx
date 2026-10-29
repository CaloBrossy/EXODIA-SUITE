import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { Link } from 'react-router-dom'
import { ObservatoryCore } from '@/components/ObservatoryCore'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

type Variant = 'primary' | 'outline' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'icon'

const variants: Record<Variant, string> = {
  primary: 'btn-grad hover:-translate-y-px active:translate-y-0',
  outline: 'border border-line bg-field hover:bg-sunken hover:border-accent/40 hover:-translate-y-px active:translate-y-0',
  ghost: 'hover:bg-sunken text-fg',
  danger: 'border border-danger/40 text-danger hover:bg-danger/10 hover:-translate-y-px',
}
const sizes: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-[13px] gap-1.5',
  md: 'h-9 px-3.5 text-sm gap-2',
  icon: 'h-8 w-8 justify-center',
}

export const buttonClass = (variant: Variant = 'outline', size: Size = 'md') =>
  cx(
    'group inline-flex items-center rounded-lg font-medium whitespace-nowrap transition-[transform,box-shadow,background-color,border-color,opacity] duration-200 disabled:opacity-45 disabled:pointer-events-none cursor-pointer select-none',
    variants[variant],
    sizes[size],
  )

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }>(
  ({ variant, size, className, type = 'button', ...p }, ref) => (
    <button ref={ref} type={type} className={cx(buttonClass(variant, size), className)} {...p} />
  ),
)

export function ButtonLink({ to, variant, size, className, children }: { to: string; variant?: Variant; size?: Size; className?: string; children: ReactNode }) {
  return (
    <Link to={to} className={cx(buttonClass(variant, size), className)}>
      {children}
    </Link>
  )
}

const fieldBase =
  'w-full rounded-lg border border-line bg-field px-2.5 text-sm text-fg placeholder:text-muted/70 transition-[border-color,box-shadow] focus:border-accent focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--nx-accent)_22%,transparent)] focus:outline-none disabled:opacity-50'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => (
  <input ref={ref} className={cx(fieldBase, 'h-9', className)} {...p} />
))

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => (
  <textarea ref={ref} className={cx(fieldBase, 'py-2 leading-relaxed', className)} {...p} />
))

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...p }, ref) => (
  <select ref={ref} className={cx(fieldBase, 'h-9 pr-7', className)} {...p} />
))

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx('flex flex-col gap-1', className)}>
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  )
}

export function Panel({ title, actions, children, className, bodyClass }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={cx('glass rounded-2xl', className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
          <h2 className="flex items-center gap-2 font-mono text-[11px] font-medium tracking-[0.18em] text-muted uppercase"><span className="h-1 w-1 rounded-full bg-accent" />{title}</h2>
          <div className="flex items-center gap-1">{actions}</div>
        </header>
      )}
      <div className={cx('p-4', bodyClass)}>{children}</div>
    </section>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-gradient text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Tag({ children, active, onClick }: { children: ReactNode; active?: boolean; onClick?: () => void }) {
  const cls = cx(
    'inline-flex items-center rounded-full border px-2 py-px text-xs transition-colors',
    active ? 'border-accent bg-accent/15 text-fg' : 'border-line text-muted',
    onClick && 'cursor-pointer hover:border-accent',
  )
  return onClick ? (
    <button type="button" className={cls} onClick={onClick}>
      {children}
    </button>
  ) : (
    <span className={cls}>{children}</span>
  )
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed border-line bg-sunken/40 px-4 py-5 text-sm">
      <p className="font-medium">{title}</p>
      {children && <p className="text-muted">{children}</p>}
      {action}
    </div>
  )
}

export function Loading({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex h-full min-h-[70vh] w-full flex-col items-center justify-center gap-4">
      <ObservatoryCore size={156} detailed live />
      <div className="text-center">
        <p className="font-mono text-[13px] font-semibold tracking-[0.32em] text-fg">EXODIA</p>
        <p className="mt-2 font-mono text-[10px] tracking-[0.2em] text-muted uppercase">{label}</p>
      </div>
    </div>
  )
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null
  return (
    <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
      {children}
    </p>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-line bg-sunken px-1 font-mono text-[11px] text-muted">{children}</kbd>
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { id: T; label: string }[] }) {
  return (
    <div role="tablist" className="glass inline-flex flex-wrap gap-1 rounded-xl p-1">
      {items.map((it) => (
        <button
          key={it.id}
          role="tab"
          type="button"
          aria-selected={value === it.id}
          onClick={() => onChange(it.id)}
          className={pillClass(value === it.id)}
        >
          {it.label}
        </button>
      ))}
    </div>
  )
}

export const pillClass = (active: boolean) =>
  cx('rounded-lg px-3 py-1 text-sm transition-all duration-200', active ? 'pill-active' : 'text-muted hover:bg-sunken hover:text-fg')
