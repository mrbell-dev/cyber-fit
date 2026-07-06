import type { ReactNode } from "react";

/** The ⓘ button that opens a card's detail sheet. Sits in a `.card-header`
 *  next to the title, so history/charts live ON the card that owns the data
 *  instead of a far-off Stats tab. */
export function InfoButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button className="card-info" aria-label={label} onClick={onClick}>
      ⓘ
    </button>
  );
}

/** Modal detail sheet — history + charts for one metric. Tap-scrim to close. */
export function InfoSheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="modal info-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="card-header">
          <h2 className="card-title">{title}</h2>
          <button className="link-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
