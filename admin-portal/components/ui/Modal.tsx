'use client'

import {
  type ReactNode,
  useEffect,
  useRef,
  createContext,
  useContext,
} from 'react'
import { cn } from '@/lib/utils'

interface ModalContextValue {
  onClose: () => void
}

const ModalContext = createContext<ModalContextValue>({ onClose: () => {} })

interface ModalProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
}

export function Modal({
  open,
  onClose,
  children,
  className,
  size = 'md',
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (open) {
      document.addEventListener('keydown', handleKey)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <ModalContext.Provider value={{ onClose }}>
      {/* Overlay */}
      <div
        ref={overlayRef}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={(e) => {
          if (e.target === overlayRef.current) onClose()
        }}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in" />

        {/* Panel */}
        <div
          role="dialog"
          aria-modal="true"
          className={cn(
            'relative z-10 w-full rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl',
            'animate-slide-in',
            sizeClasses[size],
            className
          )}
        >
          {children}
        </div>
      </div>
    </ModalContext.Provider>
  )
}

interface ModalHeaderProps {
  title: string
  description?: string
  onClose?: () => void
}

export function ModalHeader({ title, description, onClose }: ModalHeaderProps) {
  const ctx = useContext(ModalContext)
  const handleClose = onClose || ctx.onClose

  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-700 px-6 py-5">
      <div>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {description && (
          <p className="mt-0.5 text-sm text-slate-400">{description}</p>
        )}
      </div>
      <button
        onClick={handleClose}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
        aria-label="Close modal"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M2 2L14 14M14 2L2 14"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  )
}

interface ModalBodyProps {
  children: ReactNode
  className?: string
}

export function ModalBody({ children, className }: ModalBodyProps) {
  return (
    <div className={cn('px-6 py-5', className)}>{children}</div>
  )
}

interface ModalFooterProps {
  children: ReactNode
  className?: string
}

export function ModalFooter({ children, className }: ModalFooterProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-end gap-3 border-t border-slate-700 px-6 py-4',
        className
      )}
    >
      {children}
    </div>
  )
}

export default Modal
