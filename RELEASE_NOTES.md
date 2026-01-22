# Release Notes v1.3.3

## 🛠 Improvements & Fixes

### 💬 Discord Embed Formatting
- **Fixed text wrapping in Discord embeds**: Player names and stat values are now properly truncated to ensure all content fits on a single line
- Reduced character limits to prevent long character names from breaking onto multiple lines in stat leaderboards
- Improved readability of Discord notifications with consistent, compact formatting

---

# Release Notes v1.3.2

## ✨ New Features

### 🖥️ In-App Terminal
- Added a new, slick slide-up **Terminal UI**!
- View application logs, upload progress, and errors directly within the app.
- Toggle it anytime by clicking the terminal icon in the header.

## 🛠 Improvements & Fixes

### 🚀 Upload Reliability v2
Further hardening of the upload process to combat 523/502 errors from dps.report:
- **Smarter Retries**: Now alternates between main and backup servers on *every* retry attempt.
- **Browser Mimicry**: Requests now look more like a standard browser to bypass aggressive Cloudflare filters.
- **Better Diagnostics**: The new terminal shows exact status codes and file sizes to help debug issues.
