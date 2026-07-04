import { createContext, useCallback, useContext, useState } from 'react'
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from '@/components/ui/toast'

interface ToastMessage {
  id: number
  title: string
  description?: string
  variant?: 'default' | 'destructive'
}

type ToastInput = Omit<ToastMessage, 'id'>

const ToastContext = createContext<((t: ToastInput) => void) | null>(null)

let nextId = 1

export function ToasterProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const toast = useCallback((input: ToastInput) => {
    setToasts((prev) => [...prev, { id: nextId++, ...input }])
  }, [])

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={toast}>
      <ToastProvider swipeDirection="right" duration={4000}>
        {children}
        {toasts.map((t) => (
          <Toast
            key={t.id}
            variant={t.variant}
            onOpenChange={(open) => {
              if (!open) dismiss(t.id)
            }}
          >
            <div className="grid gap-0.5">
              <ToastTitle>{t.title}</ToastTitle>
              {t.description && (
                <ToastDescription>{t.description}</ToastDescription>
              )}
            </div>
            <ToastClose />
          </Toast>
        ))}
        <ToastViewport />
      </ToastProvider>
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToasterProvider')
  return ctx
}
