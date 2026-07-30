'use client';

import { ReactNode, FormEvent } from 'react';

interface FormModalProps {
  title: string;
  open: boolean;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
  submitting?: boolean;
  error?: string | null;
  submitLabel?: string;
  children: ReactNode;
}

/**
 * Lightweight modal + form wrapper used by the data-entry forms.
 * Styling reuses the existing .card / .form-field / button classes; the overlay
 * is inline since there's no overlay class in globals.css.
 */
export default function FormModal({
  title,
  open,
  onClose,
  onSubmit,
  submitting = false,
  error = null,
  submitLabel = 'Save',
  children,
}: FormModalProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: 16,
      }}
    >
      <div
        className="card"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 460, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', marginTop: 0 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button
            type="button"
            className="secondary"
            onClick={onClose}
            aria-label="Close"
            style={{ padding: '4px 10px' }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={onSubmit}>
          {children}

          {error && (
            <p style={{ color: 'var(--signal-bad)', fontSize: '0.85rem', marginTop: 12 }}>{error}</p>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : submitLabel}
            </button>
            <button type="button" className="secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
