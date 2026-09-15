import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AlertCircle, Check, X } from "lucide-react";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  isAlert?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = "Yes",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  isAlert = false,
}) => {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const closeModal = isAlert ? onConfirm : onCancel;
  const isDestructive = /delete|clear|reset|remove/i.test(`${title} ${confirmText}`);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeModal?.();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    confirmButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, closeModal]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="app-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop Blur overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeModal}
            className="absolute inset-0 bg-black/60 backdrop-blur-xl"
          />

          {/* Glass Card content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: "spring", duration: 0.4, bounce: 0.15 }}
            className="confirm-modal liquid-glass-strong relative w-full max-w-md overflow-hidden p-5"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-modal-title"
            aria-describedby="confirm-modal-message"
          >
            <div className="relative z-10 flex items-start gap-3.5">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${isDestructive ? "border-[#ff5050]/25 bg-[#ff5050]/10 text-[#ff5050]" : "border-white/[0.14] bg-white/[0.05] text-white/70"}`}>
                <AlertCircle size={20} strokeWidth={2.2} />
              </div>
              <div className="space-y-1.5 flex-1 min-w-0">
                <h3 id="confirm-modal-title" className="text-base font-semibold leading-5 text-white">
                  {title}
                </h3>
                <p id="confirm-modal-message" className="text-xs leading-relaxed text-white/50">
                  {message}
                </p>
              </div>
            </div>

            <div className="relative z-10 mt-5 flex items-center justify-end gap-2.5">
              {!isAlert && onCancel && (
                <button
                  onClick={onCancel}
                  className="figma-soft-button flex min-h-11 items-center gap-1.5 px-4 text-xs font-semibold text-white/60 transition hover:text-white active:scale-95"
                >
                  <X size={13} />
                  <span>{cancelText}</span>
                </button>
              )}
              <button
                ref={confirmButtonRef}
                onClick={onConfirm}
                className={`flex min-h-11 items-center gap-1.5 rounded-full border px-5 text-xs font-semibold text-white transition active:scale-95 ${isDestructive ? "border-[#ff5050]/25 bg-[#ff5050]/12 hover:bg-[#ff5050]/18" : "border-white/[0.2] bg-white/[0.15] hover:bg-white/[0.2]"}`}
              >
                <Check size={13} strokeWidth={3} />
                <span>{confirmText}</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
