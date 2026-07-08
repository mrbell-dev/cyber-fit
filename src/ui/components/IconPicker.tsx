import { useState } from "react";

const EMOJI_SUGGESTIONS = ["⚡", "🧘", "🦾", "📖", "🧠", "🚶", "🥗", "🌙", "🫁", "💊", "🎸", "🐣"];

// The web can't switch the OS keyboard to emoji, so we ship our own picker.
const EMOJI_GRID = [
  "⚡", "🔥", "💪", "🦾", "🦿", "🧠", "🫀", "🫁", "👁️", "🤖", "👾", "🕶️",
  "🧘", "🏃", "🚶", "🏋️", "🤸", "🚴", "🏊", "🥊", "⛰️", "🧗", "🛹", "⚽",
  "📖", "📚", "✍️", "🎓", "🧪", "💻", "🎯", "♟️", "🧩", "🎨", "🎸", "🎹",
  "🥗", "🍎", "🥦", "🍳", "🥑", "🍵", "💧", "🚰", "☕", "🥤", "🍽️", "🧂",
  "🌙", "😴", "🛏️", "🌅", "☀️", "🌆", "🌃", "⭐", "🌧️", "🌿", "🌵", "🌸",
  "💊", "🩺", "🦷", "🧼", "🛁", "🧴", "❤️", "💚", "💜", "🖤", "✨", "🐣",
  "🦎", "🐕", "🐈", "🌊", "🔋", "📵", "🎮", "🗡️", "🛡️", "💾", "📡", "🔧",
];

/** Icon input + suggestion strip + expandable grid — shared by the directive
 *  and goal editors. Controlled: parent owns the icon value. */
export function IconPicker({ icon, onPick }: { icon: string; onPick: (icon: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="editor-icon-row">
        <input
          className="input editor-icon"
          value={icon}
          onChange={(e) => onPick(e.target.value)}
          aria-label="Emoji"
          maxLength={4}
        />
        <div className="emoji-strip" role="group" aria-label="Emoji suggestions">
          {EMOJI_SUGGESTIONS.map((e) => (
            <button key={e} className="emoji-pick" onClick={() => onPick(e)} aria-label={`Use ${e}`}>
              {e}
            </button>
          ))}
          <button
            className={open ? "emoji-pick more on" : "emoji-pick more"}
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-label={open ? "Close emoji picker" : "More emoji"}
          >
            …
          </button>
        </div>
      </div>

      {open && (
        <div className="emoji-grid" role="group" aria-label="Emoji picker">
          {EMOJI_GRID.map((e) => (
            <button
              key={e}
              className="emoji-pick"
              onClick={() => {
                onPick(e);
                setOpen(false);
              }}
              aria-label={`Use ${e}`}
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
