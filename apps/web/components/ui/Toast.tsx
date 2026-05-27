'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'

type ToastKind = 'success' | 'error' | 'info'
interface Toast {
  id: number
  kind: ToastKind
  message: string
}

interface ToastContext {
  show: (message: string, kind?: ToastKind) => void
}

const Ctx = createContext<ToastContext>({ show: () => {} })

let nextId = 1

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const show = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = nextId++
    setToasts((prev) => [...prev, { id, kind, message }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3500)
  }, [])

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onClose={() => setToasts((prev) => prev.filter((p) => p.id !== t.id))} />
        ))}
      </div>
    </Ctx.Provider>
  )
}

export function useToast(): ToastContext {
  return useContext(Ctx)
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  const iconByKind = { success: '✅', error: '❌', info: '💬' } as const
  const bgByKind = {
    success: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    error:   'bg-rose-50 border-rose-200 text-rose-900',
    info:    'bg-white border-gray-200 text-ink-900',
  } as const

  return (
    <button
      type="button"
      onClick={onClose}
      className={`pointer-events-auto flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-lifted text-sm font-medium transition-all duration-300 ${bgByKind[toast.kind]} ${
        visible ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'
      }`}
    >
      <span className="text-lg leading-none">{iconByKind[toast.kind]}</span>
      <span>{toast.message}</span>
    </button>
  )
}
