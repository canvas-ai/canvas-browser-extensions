import React from "react"
import { useToast } from "../../hooks/use-toast"
import { Toast } from "./toast"
import styles from "./toast.module.scss"

export function Toaster() {
  const { toasts, dismiss } = useToast()

  return (
    <div className={styles.toaster}>
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          title={toast.title}
          description={toast.description}
          action={toast.action}
          variant={toast.variant}
          onClose={() => dismiss(toast.id)}
        />
      ))}
    </div>
  )
}
