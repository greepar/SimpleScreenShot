# Changelog

All notable changes to Simple ScreenShot are documented here.

## [Unreleased]

### Added

- A persistent pointer toggle and frozen pointer preview in the capture toolbar.

### Fixed

- Allow the capture shortcut while shell menus, including the Zorin start menu, are open. Freeze menus before releasing their input grabs.
- Keep the top selection shade anchored to the screen origin instead of appearing as a dark horizontal band across the selected area.

## [0.1.2] - 2026-08-29

### Fixed

- Fixed the capture shortcut being overwritten by Ubuntu Dock because both extensions used the same internal keybinding name.
- Automatically migrate shortcuts saved by versions 0.1.0 and 0.1.1.

## [0.1.1] - 2026-08-26

### Changed

- Replaced raw accelerator text editing with an easy press-to-record shortcut dialog.
- Added clear, cancel, and one-click reset actions for the keyboard shortcut.
- Set the default capture shortcut explicitly to `Shift + Super + S`.

## [0.1.0] - 2026-08-24

Initial public release.

### Added

- Windows-style frozen-screen capture overlay.
- Rectangular, window, and full-screen capture modes.
- Multi-monitor capture, clipboard copy, automatic PNG saving, and notifications.
- GTK4/Libadwaita editor with pen, highlighter, arrow, rectangle, text, mosaic, and crop tools.
- Undo/redo, copy, save, save-as, and recent capture history.
- Preferences for keyboard shortcut, default mode, storage, notifications, pointer inclusion, and panel indicator.
- Japanese and English UI.
- SHA-256-verified one-line installer.
