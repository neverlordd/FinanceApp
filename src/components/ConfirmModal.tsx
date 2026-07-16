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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
            className="relative w-full max-w-md bg-slate-950/90 backdrop-blur-2xl border border-white/[0.1] p-6 rounded-3xl shadow-[0_32px_64px_rgba(0,0,0,0.6)] overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-modal-title"
            aria-describedby="confirm-modal-message"
          >
            {/* Glowing effect inside the card */}
            <div className="absolute top-0 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />
            <div className="absolute top-[-40px] left-[40%] w-[120px] h-[120px] rounded-full bg-emerald-500/10 blur-[40px] pointer-events-none" />

            <div className="flex gap-4 items-start relative z-10">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl shrink-0">
                <AlertCircle size={20} strokeWidth={2.2} />
              </div>
              <div className="space-y-1.5 flex-1 min-w-0">
                <h3 id="confirm-modal-title" className="text-sm font-black text-white/95 tracking-wider uppercase font-sans">
                  {title}
                </h3>
                <p id="confirm-modal-message" className="text-xs text-white/60 leading-relaxed font-sans">
                  {message}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 mt-6 relative z-10">
              {!isAlert && onCancel && (
                <button
                  onClick={onCancel}
                  className="px-4 py-2.5 rounded-2xl border border-white/[0.06] hover:border-white/[0.15] bg-white/[0.02] hover:bg-white/[0.06] text-white/60 hover:text-white text-xs font-bold transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
                >
                  <X size={13} />
                  <span>{cancelText}</span>
                </button>
              )}
              <button
                ref={confirmButtonRef}
                onClick={onConfirm}
                className={`px-5 py-2.5 rounded-2xl text-slate-950 text-xs font-black transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 ${isDestructive ? "bg-rose-500 hover:bg-rose-400 shadow-[0_4px_16px_rgba(244,63,94,0.25)]" : "bg-emerald-500 hover:bg-emerald-400 shadow-[0_4px_16px_rgba(16,185,129,0.3)]"}`}
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
