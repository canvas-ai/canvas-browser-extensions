import React from "react"
import styles from "./toast.module.scss"

interface ToastProps {
  title?: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactElement
  variant?: "default" | "destructive"
  onClose?: () => void
}

const Toast: React.FC<ToastProps> = ({
  title,
  description,
  action,
  variant = "default",
  onClose,
}) => {
  const handleToastClick = () => {
    if (onClose) {
      onClose();
    }
  };

  return (
    <div
      className={`${styles.toast} ${styles[variant]}`}
      onClick={handleToastClick}
      style={{ cursor: 'pointer' }}
    >
      <div className={styles.toastContent}>
        {title && <div className={styles.toastTitle}>{title}</div>}
        {description && <div className={styles.toastDescription}>{description}</div>}
      </div>
      {action && <div className={styles.toastAction}>{action}</div>}
      <button
        className={styles.toastClose}
        onClick={(e) => {
          e.stopPropagation(); // Prevent the toast click handler from firing
          if (onClose) onClose();
        }}
      >
        ✕
      </button>
    </div>
  )
}

export { Toast }
