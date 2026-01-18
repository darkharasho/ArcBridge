# GW2 Arc Log Uploader

A premium, high-performance Electron application for Guild Wars 2 players to automatically upload arcdps combat logs, notify Discord, and view detailed WvW statistics in a stunning, modern interface.

## TODO

- [x] add in dps and damage from enemy summary
- [ ] ensure the appimage only launches one instance of the app instead of many

## ✨ Features

- **🚀 Automated Monitoring**: Automatically detects, uploads, and processes new combat logs as they are created.
- **🎨 Premium UI**: A dark, glassmorphic interface built with React, Tailwind CSS, and Framer Motion for a smooth, high-end experience.
- **📊 Detailed WvW Statistics**: Expanded log cards providing deep insights:
    - **Squad Summary**: Damage, DPS, Downs, and Deaths for your squad.
    - **Enemy Summary**: Total damage taken and enemy player counts.
    - **Incoming Stats**: Track Misses, Blocks, CC (Interrupts), and Boon Strips.
    - **Top Rankings**: Ranked lists for Damage, Down Contribution, Healing, Barrier, Cleanses, Strips, CC, and Stability.
- **💬 Discord Integration**: Real-time notifications with detailed embed summaries, matching the aesthetics of the local UI.
- **🌐 Browser Fallback**: One-click to open full reports on `dps.report` in your default system browser.
- **📦 Drag & Drop Support**: Manually upload individual log files simply by dragging them into the app.

## 🛠️ Technology Stack

- **Framework**: Electron + React
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Backend API**: dps.report

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v16+)
- [npm](https://www.npmjs.com/)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/darkharasho/gw2_arc_log_uploader.git
   cd gw2_arc_log_uploader
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the application in development mode:
   ```bash
   npm run dev
   ```

4. Build the application for production:
   ```bash
   npm run build
   ```

## 📖 Usage

1. **Configure Log Directory**: Set your `arcdps.cbtlogs` folder in the Configuration panel.
2. **Discord Notification**: Paste your Discord Webhook URL to receive summaries in your channel.
3. **Automatic Uploads**: The app will watch the directory and process new logs automatically.
4. **View Details**: Click on any log card in the activity list to expand the detailed statistics view.

## 📄 License

This project is licensed under the MIT License—see the LICENSE file for details.
