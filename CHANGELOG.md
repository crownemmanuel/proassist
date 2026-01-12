# Changelog

All notable changes to ProAssist will be documented in this file.

## [0.2.5] - 2024-12-19

### Added
- Update notification component that checks for updates on app startup
- Developer mode with log viewer to debug issues and view console logs
- Enhanced WebSocket error logging with detailed connection information
- Session creation loading states and success messages in Live Slides modal
- Copy link button in Live Slides linked items when session is active
- macOS installation instructions in release notes for unsigned app

### Changed
- Improved Live Slides session creation UX with loading and success states
- Enhanced update check logging with `[Updater]` prefixes for easier filtering
- Updated release notes template to include macOS installation instructions
- Reordered Version Settings page (Updates at top, Developer Tools at bottom)
- Updated button styling (Check for Updates is purple, Developer Mode is dark gray)

### Fixed
- WebSocket connection issues in production builds (added CSP for WebSocket connections)
- Local IP detection fallback to 127.0.0.1 when detection fails
- Session creation status messages (shows "Creating session..." instead of "Session not running" during creation)

### Technical
- Added Content Security Policy to allow WebSocket connections
- Enhanced WebSocket error handling and logging
- Added session creation state tracking
- Improved local IP detection with fallback

## [0.2.4] - Previous Release
- Initial release with auto-update support
