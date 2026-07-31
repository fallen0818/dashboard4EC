'use client';

import { useState } from 'react';

interface Props {
  onEdit: () => void;
  onDelete: () => Promise<void> | void;
  /** Optional confirmation prompt text shown inline before deleting. */
  confirmLabel?: string;
}

/**
 * Compact Edit / Delete controls for a table row. Delete uses a two-step
 * inline confirm (Delete → Confirm / Cancel) so a single misclick can't
 * destroy a record.
 */
export default function RowActions({ onEdit, onDelete, confirmLabel }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      await onDelete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
      setDeleting(false);
      setConfirming(false);
    }
  }

  const link: React.CSSProperties = {
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.72rem',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  };

  if (confirming) {
    return (
      <span style={{ display: 'inline-flex', gap: 10, alignItems: 'center', whiteSpace: 'nowrap' }}>
        {confirmLabel && <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{confirmLabel}</span>}
        <button style={{ ...link, color: 'var(--signal-bad)' }} onClick={handleDelete} disabled={deleting}>
          {deleting ? 'Deleting…' : 'Confirm'}
        </button>
        <button style={{ ...link, color: 'var(--text-muted)' }} onClick={() => setConfirming(false)} disabled={deleting}>
          Cancel
        </button>
      </span>
    );
  }

  return (
    <span style={{ display: 'inline-flex', gap: 12, alignItems: 'center', whiteSpace: 'nowrap' }}>
      <button style={{ ...link, color: 'var(--copper)' }} onClick={onEdit}>
        Edit
      </button>
      <button style={{ ...link, color: 'var(--text-muted)' }} onClick={() => setConfirming(true)}>
        Delete
      </button>
      {error && <span style={{ color: 'var(--signal-bad)', fontSize: '0.7rem' }}>{error}</span>}
    </span>
  );
}
