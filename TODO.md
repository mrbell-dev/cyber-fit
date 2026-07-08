# TODO — raw punch-list

Raw feature capture. Items graduate into PLAN.md's TIER LIST when they're
scoped; nothing here is committed work yet.

## Goals (captured 2026-07-08, Michael)

A general goals system, distinct from directives/habits:

- **Viewable goals:** a place in the app to define and view general goals
  (e.g. "work out 4x/week", "read 12 books this year") with progress toward
  them — not a daily checkbox, a target with a horizon.
- **Goal reminders:** pings that push toward a goal on the days you would
  otherwise coast — e.g. a workout reminder specifically on days that are NOT
  your usual gym days, when the weekly goal is behind pace. (The existing
  `Reminders.workout {days, time}` fires on fixed days; goal reminders are the
  inverse: schedule-aware, pace-aware.)
- Open design questions for the brainstorm: where goals live in the data model
  (new table vs derived from logs + a target), how pace is computed
  (timesPerWeek-style rolling window vs calendar period), pillar check
  (forgiving-by-default: a behind-pace nudge must read as an invitation, never
  a debt; relay stays completion-blind so pace-aware pings are in-app/SMS only,
  push stays generic), and how this relates to the existing timesPerWeek
  schedule kind (which already expresses "N per week" without a goal object).
