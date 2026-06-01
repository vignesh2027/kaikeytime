# Changelog

## [1.0.1] — 2026-06-01

### Fixed
- AI detection off-by-one: threshold now correctly counts lines, not newlines

## [1.0.0] — 2026-06-01

### Added
- Live **Pulse** status bar (focus time + streak, updates every second)
- Full **analytics dashboard** — weekly bar chart, language donut, heatmap, streak, AI ratio, insights
- **Strand card generator** — daily/weekly/monthly PNG export at 1200×630, four themes
- **AI-assisted code ratio** estimation via large-insertion detection
- **Activity heatmap** (day-of-week × hour) for all-time patterns
- Local-only JSON storage — zero network requests with user data
- `KaikeyTime: Export My Data (JSON)` command
- `KaikeyTime: Reset All Data` command with confirmation
- First-run welcome notification
- Configurable idle threshold, AI threshold, Strand theme, status bar toggle
