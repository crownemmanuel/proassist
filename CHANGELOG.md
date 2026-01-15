# Changelog

All notable changes to ProAssist will be documented in this file.

## [0.5.1] - 2025-01-29

### Changed
- **Transcription Settings UI**: Reorganized Transcription Settings for better UX
  - Combined "Native Microphone" and "Microphone" fields into a single "Microphone" dropdown that automatically shows native devices when native audio capture is enabled
  - Moved "AssemblyAI API Key" section to appear right after "Transcription Engine"
  - Moved "Run transcription in browser" checkbox to appear directly below microphone selection

### Improved
- **Transcription Stop Button**: Added immediate visual feedback when stopping transcription
  - Button shows "Stopping..." with spinner icon and is disabled immediately when clicked
  - Prevents multiple stop requests and provides clear feedback during the stopping process

### Fixed
- **Browser Transcription Text Visibility**: Fixed black text visibility issues when browser transcription mode is enabled
  - Changed "Browser" badge text color from black to white for better visibility on warning-colored background
  - Changed "Waiting for browser..." button text color from black to white

## [0.5.0] - 2025-01-28

### Added
- **Live Transcription Streaming via WebSocket**: SmartVerses transcriptions can now be streamed in real-time to Live Slides Notepad and other WebSocket clients
- **Transcription Settings**: Added "Stream transcription output to WebSocket" checkbox in SmartVerses Settings (enabled by default)
- **Live Transcription Panel in Notepad**: New "Live Transcription" button in Live Slides Notepad that enables a 70/30 split view
- **Transcription Chunk Cards**: Final transcript chunks appear as bordered cards with click-to-add functionality
- **Client-Side Filters**: Filter transcription display by Transcript, Scripture References, and Key Points
- **Real-time Transcription Display**: See interim and final transcripts as they arrive, including detected scripture references and extracted key points
- **WebSocket Broadcast Service**: New Tauri command to broadcast transcription events to all connected Live Slides clients

### Changed
- Live Slides Notepad now supports split-view mode for viewing live transcriptions alongside slide editing
- Transcription chunks can be directly added to slides via click-to-insert functionality

### Technical
- Added `broadcast_live_slides_message` Tauri command for flexible WebSocket broadcasting
- Extended Live Slides WebSocket message types to include `transcription_stream` payload
- Transcription broadcast service integrates with existing Live Slides `/ws` server infrastructure
- Key points and scripture references are included in transcription stream when enabled in settings

## [0.4.1] - 2025-01-27

### Added
- ProPresenter connection selector for all "Get Slide" buttons
- Connection selector dropdown appears when 2+ ProPresenter connections are enabled
- Connection label display when only 1 connection is enabled (shows which connection is being used)

### Fixed
- Fixed tab switching bug in Timer Schedule Automation modal - no longer switches back to "Trigger Slide" tab when clicking "Get Slide" after switching to "Change Layout" tab
- Fixed issue where automation modal would re-initialize when currentAutomations prop changed, causing unwanted tab resets

### Changed
- All "Get Slide" functionality now uses the selected ProPresenter connection instead of trying all connections sequentially
- Improved UX: users can now explicitly choose which ProPresenter instance to get slides from when multiple instances are configured

### Technical
- Updated ActivatePresentationModal, ScheduleAutomationModal, LiveTestimoniesSettings, and AISettingsForm to include connection selection
- Added hasInitialized flag to ScheduleAutomationModal to prevent unwanted re-initialization

## [0.4.0] - 2025-01-XX

### Added
- Network import for live slides from master server - backup sync method when WebSocket auto-sync doesn't work well
- `/api/live-slides` JSON endpoint in backend to expose all live slide sessions
- Import dropdown with "From Text" and "From Network" options (matches Load Schedule pattern)
- ImportFromNetworkModal component that uses existing network sync settings (no manual IP/port input needed)
- Auto-fetch sessions when network import modal opens
- Session selection with checkboxes, marking already imported sessions
- "Select All New" and "Clear" buttons for bulk selection

### Changed
- Import button now shows as dropdown menu with multiple import options
- "From Network" option is disabled when not configured as slave/peer (shows "Not configured" badge)

### Technical
- Added `fetchSlidesFromMaster()` function in liveSlideService
- Network import uses same connection settings as schedule sync (Settings → Network)
- Follows same pattern as "Get Latest from Master" for schedules

## [0.3.4] - 2025-01-13

### Fixed
- Fixed ProPresenter connection failures on Windows by adding HTTP protocol support to Content Security Policy (CSP)
- Windows WebView2 was blocking HTTP fetch requests to ProPresenter API due to missing `http://localhost:*` and `http://*:*` in CSP `connect-src` directive

### Technical
- Updated CSP in `tauri.conf.json` to allow HTTP connections for ProPresenter API integration
- Added support for both `http://localhost:*` and `http://127.0.0.1:*` for better cross-platform compatibility

## [0.3.3] - 2025-01-12

### Added
- Vision model recommendations in Timer Assistant settings that dynamically suggest appropriate models based on selected provider
- Helpful tips for Groq (Llama 4 Scout/Maverick), Gemini (1.5 Flash/Pro, 2.0 Flash), and OpenAI (GPT-4o, GPT-4o mini, GPT-4 Turbo)

### Changed
- Enhanced Timer Assistant settings UI with contextual model recommendations for better user guidance

## [0.3.2] - 2025-01-XX

### Fixed
- Improved error handling for localStorage template parsing with try-catch blocks
- Enhanced error logging for Live Slides auto-start server failures
- Added error logging for WebSocket reconnection failures in Live Slides and Network Sync services
- Better error messages when template loading fails

### Changed
- Improved error handling and logging throughout the application for better debugging

## [0.3.1] - 2025-01-XX

### Added
- Firebase configuration import modal for easier setup
- Firebase config parser utility for validating and importing Firebase settings

### Changed
- Improved import modal functionality
- Enhanced Live Testimonies settings
- Updated ProPresenter service integration

### Fixed
- Various UI improvements and bug fixes

## [0.3.0] - 2025-01-XX

### Changed
- Upgraded version target to 0.3.0 for enhanced stability and performance

## [0.2.6] - 2025-01-XX

### Added
- ProPresenter presentation activation feature - automatically trigger presentations when slides go live
- Global activation button to set default presentation for all slides in a playlist item
- Per-slide activation override to customize presentation triggers for individual slides
- Timer dropdown for slides - select schedule sessions to trigger when going live
- Auto-start timer sessions when "Go Live" is clicked if a timer session is selected
- Ability to remove/clear activation triggers at both global and slide levels
- ActivatePresentationModal component for configuring presentation triggers

### Changed
- ProPresenter test connection now uses `/version` endpoint instead of `/v1/version`
- Improved ProPresenter connection test success message to show host description
- Slide activation buttons now show "None", "Default", or "Custom" based on configuration

### Fixed
- ProPresenter test connection endpoint (changed from `/v1/version` to `/version` to fix 404 errors)
- Live Slides production build issues with embedded HTTP server and WebSocket paths
- Slide parsing improvements for Live Slides

### Technical
- Added `getCurrentSlideIndex()` and `triggerPresentationSlide()` API functions
- Added `ProPresenterActivationConfig` type for presentation activation settings
- Enhanced slide and playlist item types with activation configuration properties
- Improved Live Slides WebSocket connection handling

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
