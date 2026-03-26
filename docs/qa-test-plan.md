# ArcBridge QA Test Plan — Playwright Automation

This document defines all QA tests needed for the ArcBridge Electron application and web report viewer. Tests are organized by feature area with unique IDs for traceability.

---

## Test Infrastructure Notes

- **Electron tests**: Use `@playwright/test` with Electron launch helpers. Mock IPC via preload injection or electron-store fixtures.
- **Web report tests**: Use standard Playwright against `http://127.0.0.1:4173` (dev server).
- **Fixtures**: Prebuilt `.zevtc` files in `testdata/`, EI JSON in `test-fixtures/`, report data in `web/report.json`.
- **Mocking strategy**: For external services (dps.report, GitHub API, Discord webhooks), intercept at the network level (`page.route()`) or inject mock IPC handlers via preload overrides.

---

## 1. Application Lifecycle

### 1.1 Launch & Window Management

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| APP-001 | App launches successfully | Start Electron app | Window opens, title contains "AxiBridge" |
| APP-002 | Window minimizes | Click minimize button (or `windowControl('minimize')`) | Window minimizes to taskbar |
| APP-003 | Window maximizes/restores | Click maximize button twice | Window maximizes then restores to previous size |
| APP-004 | Window close — minimize mode | Set closeBehavior=minimize, click close | Window hides but process remains (tray) |
| APP-005 | Window close — quit mode | Set closeBehavior=quit, click close | App exits cleanly |
| APP-006 | Custom titlebar renders | Launch app | Custom titlebar with min/max/close buttons visible |
| APP-007 | Dev userData isolation | Launch in dev mode | userData path ends with `AxiBridge-Dev`, not `AxiBridge` |

### 1.2 First-Time Experience

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| FTE-001 | Walkthrough shows on first launch | Launch with `walkthroughSeen=false` | WalkthroughModal appears with 3-step tour |
| FTE-002 | Walkthrough step navigation | Click through walkthrough steps | Each step shows correct content (Collect → Understand → Share) |
| FTE-003 | Walkthrough "Learn More" link | Click "Learn More" in walkthrough | HowToModal opens |
| FTE-004 | Walkthrough dismissed permanently | Complete walkthrough | `walkthroughSeen` saved as true; modal does not appear on next launch |
| FTE-005 | Walkthrough does not show on subsequent launch | Launch with `walkthroughSeen=true` | No walkthrough modal |

### 1.3 Auto-Update

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| UPD-001 | Check for updates — update available | Mock `update-available` event | UI shows update notification |
| UPD-002 | Check for updates — no update | Mock `update-not-available` event | UI shows "up to date" message |
| UPD-003 | Download progress indicator | Mock `download-progress` events (0→100%) | Progress bar updates in real time |
| UPD-004 | Update downloaded — restart prompt | Mock `update-downloaded` event | Prompt to restart appears |
| UPD-005 | Update error shows modal | Mock `update-error` event | UpdateErrorModal appears with error message |
| UPD-006 | Restart app for update | Click restart after update downloaded | `restart-app` IPC called |
| UPD-007 | What's New modal on version bump | Launch with new version > lastSeenVersion | WhatsNewModal shows release notes |
| UPD-008 | What's New modal dismissed | Close What's New modal | `setLastSeenVersion` called with current version |
| UPD-009 | Auto-update disabled for portable builds | Launch as non-packaged/portable | Update check shows "not supported" message |

---

## 2. Navigation & Layout

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| NAV-001 | Dashboard view is default | Launch app | Dashboard view visible, nav tab active |
| NAV-002 | Navigate to Stats view | Click Stats nav tab | StatsView renders, Dashboard hidden |
| NAV-003 | Navigate to Fight Reports view | Click Fight Reports nav tab | FightReportHistoryView renders |
| NAV-004 | Navigate to Settings view | Click Settings nav tab | SettingsView renders |
| NAV-005 | Navigate back to Dashboard | Click Dashboard tab from any other view | Dashboard renders with log cards |
| NAV-006 | Active tab indicator | Click each tab | Active tab visually highlighted |
| NAV-007 | StatsView preserved on tab switch | Switch away from Stats then back | StatsView shows same state (display:none, not unmount) |
| NAV-008 | Sidebar icons render | Launch app | All navigation icons visible in sidebar |

---

## 3. Dashboard View (Log Cards)

### 3.1 Log Card Display

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| DASH-001 | Empty state — no logs | Launch with no logs | Empty state message or prompt to configure log directory |
| DASH-002 | Log card renders fight info | Have 1 uploaded log | Card shows fight name, duration, squad/enemy count |
| DASH-003 | Log card shows win/loss | Upload a log with known outcome | Win/loss indicator displayed correctly |
| DASH-004 | Log card shows time elapsed | Upload a log | Relative timestamp shown (e.g., "2 min ago") |
| DASH-005 | Log card shows combat stats | Upload log with details | Damage, downs, healing, barriers, cleanses, strips, CC, stability visible |
| DASH-006 | Multiple log cards render | Upload 5 logs | All 5 cards visible, scrollable |
| DASH-007 | Log card status — Queued | Queue a log | Card shows "Queued" status indicator |
| DASH-008 | Log card status — Uploading | Begin upload | Card shows "Uploading" status with animation |
| DASH-009 | Log card status — Success | Complete upload | Card shows "Success" status |
| DASH-010 | Log card status — Error | Fail an upload | Card shows "Error" status with message |
| DASH-011 | Log card status — Retrying | Retry a failed upload | Card shows "Retrying" status |

### 3.2 Log Card Interactions

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| DASH-020 | Expand log card | Click on a completed log card | Card expands to show detailed player-by-player stats |
| DASH-021 | Collapse log card | Click expanded card header | Card collapses back to summary |
| DASH-022 | Cancel queued upload | Click cancel on a queued log | Upload removed from queue, card updates |
| DASH-023 | Remove log | Click remove on a log card | Log removed from list, persisted |
| DASH-024 | Open dps.report link | Click external link on completed log | Opens dps.report permalink in default browser |
| DASH-025 | Top stats display | Enable "Show Top Stats" in settings | Top player stats shown on dashboard cards |
| DASH-026 | MVP display | Enable "Show MVP" in settings | MVP badge shown on qualifying player |
| DASH-027 | Round count stats toggle | Toggle "Round Count Stats" | Stats switch between total and per-round |
| DASH-028 | Split players by class | Enable "Split Players by Class" | Players grouped by profession in card |

### 3.3 Drag & Drop Upload

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| DND-001 | Drag .zevtc file onto app | Drag a .zevtc file over window | Drop zone indicator appears |
| DND-002 | Drop .zevtc file | Drop .zevtc file on window | File queued for upload, log card appears |
| DND-003 | Drop multiple files | Drop 3 .zevtc files | All 3 queued, bulk upload mode activates |
| DND-004 | Drop invalid file type | Drop a .txt file | File rejected, no upload queued |
| DND-005 | Drop .evtc file | Drop a .evtc file | File accepted and queued |

---

## 4. Upload Flow

### 4.1 Auto-Upload (File Watcher)

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| UPL-001 | Watcher starts on configured directory | Set log directory in settings | `start-watching` IPC sent with directory path |
| UPL-002 | New .zevtc detected | Create new .zevtc file in watched dir | `log-detected` event fires, card appears in dashboard |
| UPL-003 | Subdirectory file detected | Create .zevtc in subdirectory (depth ≤5) | File detected and queued |
| UPL-004 | Existing files ignored on start | Start watcher with existing files | No backfill upload of existing files |
| UPL-005 | Non-log files ignored | Create .txt file in watched dir | No upload triggered |

### 4.2 Manual Upload

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| UPL-010 | Manual single file upload | Select file via file picker | File queued and uploaded |
| UPL-011 | Manual batch upload | Select 5 files via file picker | All 5 queued, max 3 concurrent |
| UPL-012 | Upload completes with permalink | Upload succeeds | Card shows dps.report permalink |
| UPL-013 | Upload status transitions | Watch upload lifecycle | Status progresses: Queued → Uploading → Calculating → Success |
| UPL-014 | Upload with dps.report token | Set token in settings, upload | Token included in upload request |
| UPL-015 | Upload without token | Clear token, upload | Upload succeeds without token (anonymous) |

### 4.3 Upload Retry Queue

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| RETRY-001 | Failed upload enters retry queue | Mock dps.report 500 error | Log appears in retry queue with error message |
| RETRY-002 | Retry queue shows failure category | Mock various errors (429, 401, network) | Correct category shown (rate-limit, auth, network) |
| RETRY-003 | Manual retry all | Click "Retry Failed" button | All failed uploads re-queued |
| RETRY-004 | Retry queue pause/resume | Pause queue, then resume | Queue pauses (no retries), resumes on demand |
| RETRY-005 | Retry count increments | Fail same upload twice | Attempt count shows 2 |
| RETRY-006 | Rate limit 429 — 60s cooldown | Mock HTTP 429 response | Queue pauses for 60 seconds before retry |
| RETRY-007 | Auth failure detection | Mock HTTP 401 response | Error categorized as "auth", suggests checking token |

### 4.4 Details Hydration

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| DET-001 | Details fetched after upload | Complete an upload | EI JSON details loaded, card shows full stats |
| DET-002 | Details cache hit | Request same log details twice | Second request served from cache (no network) |
| DET-003 | Details fetch failure | Mock dps.report JSON endpoint 500 | Card shows partial data, retry available |
| DET-004 | Parallel details hydration | Upload 5 logs, observe fetch | Up to 3 concurrent detail fetches |
| DET-005 | Details prewarm | Navigate to stats with cached logs | Details pre-fetched in background |

---

## 5. File Picker Modal

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| FP-001 | Open file picker | Click file picker button | FilePickerModal opens, shows files in log directory |
| FP-002 | File list displays metadata | Open file picker with logs present | Each file shows name, modified date, size |
| FP-003 | Search files | Type in search box | File list filtered by search term |
| FP-004 | Date range filter — Since | Set "Since" date filter | Only files after date shown |
| FP-005 | Date range filter — Day | Set "Day" date filter | Only files from that day shown |
| FP-006 | Date range filter — Between | Set date range | Only files within range shown |
| FP-007 | Single file selection | Click a file | File highlighted as selected |
| FP-008 | Batch selection — checkbox | Check multiple file checkboxes | Multiple files selected |
| FP-009 | Batch selection — Shift+click | Click first file, Shift+click fifth | Files 1-5 selected |
| FP-010 | Upload selected files | Select files, click "Upload Selected" | Selected files queued for upload, modal closes |
| FP-011 | Cancel file picker | Click cancel or close | Modal closes, no uploads triggered |

---

## 6. Stats View

### 6.1 Stats Aggregation

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| STAT-001 | Stats view renders with data | Navigate to Stats with uploaded logs | Stats sections render with aggregated data |
| STAT-002 | Stats empty state | Navigate to Stats with no logs | Empty state message shown |
| STAT-003 | Stats computation — inline (≤8 logs) | Load 5 logs, open Stats | Stats computed on main thread, no worker |
| STAT-004 | Stats computation — worker (>8 logs) | Load 10 logs, open Stats | Web Worker used, progress indicator shown |
| STAT-005 | Stats aggregation caching | Switch tabs away and back | Cache hit, no recomputation |
| STAT-006 | Stats update on new log | Upload new log while on Stats | Stats recompute with new data included |

### 6.2 Stats Sections (34 sections)

Each section tests follow this pattern: renders, shows correct data, responds to filters/sort.

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| SEC-001 | Overview section renders | Open Stats | Fight summary: duration, squad size, enemy count, outcome |
| SEC-002 | Top Players / MVP section | Open Stats | MVP rankings displayed with scores |
| SEC-003 | Offense section — damage leaderboard | Open Offense section | Top 10 damage dealers listed, sortable |
| SEC-004 | Defense section — defensive stats | Open Defense section | Heals, cleanses, barrier leaderboards |
| SEC-005 | Support section — boon generation | Open Support section | Boon generation stats per player |
| SEC-006 | Damage Mitigation section | Open section | Damage reduction percentages |
| SEC-007 | Conditions section | Open section | Condition application metrics |
| SEC-008 | Skill Usage section | Open section | Top skills by damage or down contribution |
| SEC-009 | Boon Uptime section | Open section | Boon presence % over time |
| SEC-010 | Boon Output section | Open section | Boon generation per player |
| SEC-011 | Boon Timeline section | Open section | Timeline charts for boon uptime |
| SEC-012 | Special Buffs section | Open section | Sigil/relic uptime tracking |
| SEC-013 | Sigil Relic Uptime section | Open section | Detailed buff tracking |
| SEC-014 | Spike Damage section | Open section | Peak damage moments listed |
| SEC-015 | Damage Breakdown section | Open section | Damage by type/source |
| SEC-016 | Healing section | Open section | Healing done leaderboard |
| SEC-017 | Healing Breakdown section | Open section | Healing by type |
| SEC-018 | Heal Effectiveness section | Open section | Overhealing analysis |
| SEC-019 | Commander Stats section | Open with commander data | Tag usage analytics displayed |
| SEC-020 | Squad Composition section | Open section | Class distribution chart |
| SEC-021 | Squad Damage Comparison | Open section | Group vs group stats |
| SEC-022 | Squad Kill Pressure | Open section | Down/kill contribution |
| SEC-023 | Tag Distance / Deaths | Open section | Distance to commander chart |
| SEC-024 | Player Breakdown section | Open section | Per-player stats matrix |
| SEC-025 | Fight Breakdown section | Open section | Stats per individual fight |
| SEC-026 | Squad Comp by Fight | Open section | Composition across fights |
| SEC-027 | Damage Modifiers section | Open section | Sigil/relic damage impact |
| SEC-028 | Timeline section | Open section | Time-series damage graphs |
| SEC-029 | Map Distribution section | Open section | Fight location breakdown |
| SEC-030 | Fight Diff Mode section | Open section | Win/loss comparison stats |
| SEC-031 | APM section | Open section | Actions per minute data |
| SEC-032 | Attendance section | Open section | Player participation across logs |
| SEC-033 | Fight Comp section | Open section | Detailed fight composition |
| SEC-034 | Top Skills section | Open section | Top damaging skills leaderboard |

### 6.3 Stats Section Interactions

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| SINT-001 | Section collapse/expand | Click section header | Section toggles between collapsed and expanded |
| SINT-002 | Leaderboard sort ascending | Click sort toggle on leaderboard | Data re-sorts ascending |
| SINT-003 | Leaderboard sort descending | Click sort toggle again | Data re-sorts descending |
| SINT-004 | Filter by class | Select a class filter | Only players of that class shown |
| SINT-005 | Filter by group | Select a group filter | Only players in that group shown |
| SINT-006 | Chart renders (pie) | Open section with pie chart | recharts PieChart renders with data |
| SINT-007 | Chart renders (bar) | Open section with bar chart | Bar chart renders with axes and data |
| SINT-008 | Chart renders (area/line) | Open section with timeline chart | Area/line chart renders with time axis |
| SINT-009 | Color coding by profession | View leaderboard | Each player colored by their GW2 profession |
| SINT-010 | Player Breakdown fullscreen | Click fullscreen on Player Breakdown | Modal opens with full-width matrix |
| SINT-011 | APM dense view fullscreen | Click fullscreen on APM | Dense APM view in modal |
| SINT-012 | Stats mode — Total | Set top stats mode to Total | All metrics show total values |
| SINT-013 | Stats mode — Per-second | Set mode to Per-second | All metrics normalized per second |
| SINT-014 | Stats mode — Per-minute | Set mode to Per-minute | All metrics normalized per minute |
| SINT-015 | Disruption method — Count | Set disruption method to Count | CC/strips shown as counts |
| SINT-016 | Disruption method — Duration | Set to Duration | CC/strips shown as duration |
| SINT-017 | Disruption method — Tiered | Set to Tiered | CC/strips shown with tiered scoring |

---

## 7. Fight Report History View (GitHub Pages)

### 7.1 Report Browsing

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| FRH-001 | Report index loads | Navigate to Fight Reports with GitHub configured | Reports list populated from `reports/index.json` |
| FRH-002 | Empty state — no reports | Navigate with no published reports | Empty state message |
| FRH-003 | Empty state — no GitHub config | Navigate without GitHub setup | Prompt to configure GitHub Pages |
| FRH-004 | Report card displays metadata | Load report index | Each report shows date, commander, fight count |
| FRH-005 | Open report tab | Click on a report | Report opens in new tab, stats rendered |
| FRH-006 | Multiple report tabs (max 5) | Open 5 reports | All 5 tabs visible and switchable |
| FRH-007 | Sixth report tab blocked | Try to open 6th report | Warning or oldest tab replaced |
| FRH-008 | Close report tab | Click close on a tab | Tab closes, adjacent tab selected |
| FRH-009 | Search reports | Type in search box | Reports filtered by search term |
| FRH-010 | Filter by commander | Select commander filter | Only reports from that commander shown |
| FRH-011 | Sort reports | Change sort order | Reports re-ordered (date, name, etc.) |

### 7.2 Repo Selector

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| FRH-020 | Default repo shown | Open Fight Reports | Default GitHub Pages repo selected |
| FRH-021 | Switch to favorite repo | Select a favorite repo from dropdown | Reports reload from that repo |
| FRH-022 | Add favorite repo | Add repo to favorites in settings | Repo appears in dropdown |
| FRH-023 | Remove favorite repo | Remove repo from favorites | Repo disappears from dropdown |

### 7.3 Report Deletion

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| FRH-030 | Enter delete mode | Click delete mode button | Checkboxes appear on report cards |
| FRH-031 | Select reports for deletion | Check multiple reports | Selected count shown |
| FRH-032 | Delete selected reports | Confirm deletion | Reports removed from GitHub repo and list |
| FRH-033 | Cancel delete mode | Click cancel in delete mode | Checkboxes hidden, no deletions |

### 7.4 Rollup Aggregation

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| FRH-040 | Rollup stats render | Open rollup view | Cross-report commander/player aggregate stats shown |
| FRH-041 | Rollup handles duplicate reports | Upload same report twice | Deduplication applied, no double-counting |

---

## 8. Settings View

### 8.1 General Settings Behavior

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| SET-001 | Settings load on mount | Navigate to Settings | All saved settings populated in form |
| SET-002 | Auto-save on change | Change any setting | Setting saved after 300ms debounce |
| SET-003 | Settings sections collapsible | Click section headers | Sections expand/collapse independently |

### 8.2 Appearance

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| SET-010 | Color palette selection | Select "Electric Blue" palette | App theme updates to Electric Blue |
| SET-011 | All palettes render | Click through each palette | Each palette applies distinct visual theme |
| SET-012 | Glass surfaces toggle | Toggle glass surfaces on/off | Frosted glass effect appears/disappears on cards |
| SET-013 | Theme persists across restart | Set theme, relaunch | Same theme applied on startup |

### 8.3 dps.report Token

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| SET-020 | Set dps.report token | Enter token in field | Token saved, used in subsequent uploads |
| SET-021 | Clear dps.report token | Click clear button | Token removed, uploads continue without auth |
| SET-022 | Token field masked | View token field | Token not displayed in plaintext |

### 8.4 GitHub Pages Setup

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| GH-001 | GitHub OAuth — start | Click "Connect with GitHub" | Device code flow initiated, code displayed to user |
| GH-002 | GitHub OAuth — complete | Complete OAuth in browser | Auth status updates, token stored |
| GH-003 | GitHub OAuth — timeout | Let device code expire | Error message shown, retry available |
| GH-004 | List user repos | After OAuth, open repo selector | User's repos listed |
| GH-005 | List org repos | After OAuth, select org | Org repos listed |
| GH-006 | Select existing repo | Choose repo from list | Repo saved, branch selector populated |
| GH-007 | Create new repo | Click "Create New", enter name | New repo created on GitHub, selected |
| GH-008 | Validate repo name | Enter invalid repo name (spaces, special chars) | Validation error shown |
| GH-009 | Branch selection | Select different branch | Branch saved, reports from that branch loaded |
| GH-010 | GitHub Pages URL auto-infer | Select repo | Base URL auto-populated (username.github.io/repo) |
| GH-011 | Ensure template | Click ensure template | Template files pushed to repo if missing |
| GH-012 | Upload logo | Select logo image | Logo uploaded to repo, shown in settings preview |
| GH-013 | Remove logo | Clear logo | Logo removed from settings, default used |
| GH-014 | Favorite repos management | Add/remove favorite repos | Favorites list updates, persists |

### 8.5 Discord Embed Settings

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| EMB-001 | Toggle squad summary | Toggle on/off | Embed includes/excludes squad summary |
| EMB-002 | Toggle enemy summary | Toggle on/off | Embed includes/excludes enemy summary |
| EMB-003 | Toggle incoming stats | Toggle on/off | Embed includes/excludes incoming stats |
| EMB-004 | Toggle class summary | Toggle on/off | Embed includes/excludes class summary |
| EMB-005 | Toggle top 10 lists | Toggle each metric independently | Each metric appears/disappears from embed |
| EMB-006 | Class display — Off | Set class display to Off | No class info in embed |
| EMB-007 | Class display — Short name | Set to Short name | Abbreviated class names shown |
| EMB-008 | Class display — Emoji | Set to Emoji | Class emojis shown |
| EMB-009 | Enemy split — by team (image) | Enable split by team, image mode | Enemies separated by team with image format |
| EMB-010 | Enemy split — by team (embed) | Enable split by team, embed mode | Enemies separated by team with embed fields |
| EMB-011 | Enemy split — by team (tiled) | Enable split by team, tiled mode | Enemies separated by team with tiled images |

### 8.6 Embed Top Stats

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| ETS-001 | Mode — Total | Set to Total | Top stats show total values |
| ETS-002 | Mode — Per-second | Set to Per-second | Top stats normalized per second |
| ETS-003 | Mode — Per-minute | Set to Per-minute | Top stats normalized per minute |
| ETS-004 | Top skill damage source — Target | Set to Target | Skill damage from target source |
| ETS-005 | Top skill damage source — Overall | Set to Overall | Skill damage from overall source |
| ETS-006 | Top skills metric — Damage | Set to Damage | Skills ranked by damage |
| ETS-007 | Top skills metric — Down Contribution | Set to Down Contribution | Skills ranked by down contribution |
| ETS-008 | Max rows setting | Set max rows to 5 | Top lists limited to 5 entries |

### 8.7 MVP Weighting

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| MVP-001 | Adjust MVP weight | Change "Down Contribution" weight to 2.0 | Weight saved, MVP recalculated |
| MVP-002 | All 15 weight sliders render | Open MVP section | All weight sliders visible and interactive |
| MVP-003 | Weight reset to default | Reset weights | All weights return to defaults |
| MVP-004 | Zero weight excludes metric | Set a weight to 0.0 | That metric excluded from MVP calculation |

### 8.8 Webhook Management

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| WH-001 | Open webhook manager | Click webhook settings | WebhookModal opens |
| WH-002 | Add webhook | Enter name + URL, save | Webhook added to list |
| WH-003 | Edit webhook | Click edit on existing webhook | Fields populate, editable |
| WH-004 | Delete webhook | Click delete, confirm | Webhook removed from list |
| WH-005 | Select active webhook | Choose webhook from selector | Active webhook updated, used for notifications |
| WH-006 | Invalid webhook URL | Enter non-URL text | Validation error shown |
| WH-007 | Multiple webhooks | Add 3 webhooks | All 3 listed, one selectable as active |
| WH-008 | Legacy webhook migration | Launch with old single `discordWebhookUrl` | Migrated to webhooks array automatically |

### 8.9 Close Behavior

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| CB-001 | Set close to minimize | Select minimize option | Setting saved |
| CB-002 | Set close to quit | Select quit option | Setting saved |
| CB-003 | Close behavior persists | Change setting, relaunch | Same behavior on next close |

### 8.10 Settings Import/Export

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| IMP-001 | Export settings | Click Export | Save dialog opens, JSON file written |
| IMP-002 | Import settings | Click Import, select JSON | Import preview shown with categories |
| IMP-003 | Selective import | Uncheck some categories | Only checked categories applied |
| IMP-004 | Import invalid file | Select non-JSON file | Error message shown |
| IMP-005 | Import partial settings | Import JSON missing some keys | Missing keys keep current values, present keys updated |
| IMP-006 | Export/import round-trip | Export, clear settings, import same file | All settings restored to exported state |

---

## 9. Discord Integration

### 9.1 Webhook Posting

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| DISC-001 | Post embed on upload complete | Upload log with webhook configured | Discord embed posted with fight summary |
| DISC-002 | Embed respects toggle settings | Disable squad summary, upload | Embed omits squad summary section |
| DISC-003 | Rate limit dedup (2 min) | Upload same log twice quickly | Second post suppressed within 2-minute window |
| DISC-004 | No webhook configured | Upload without webhook | No Discord post attempted, no error |
| DISC-005 | Webhook URL invalid/unreachable | Set invalid URL, upload | Error logged, upload still succeeds |

### 9.2 Embed Content

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| DISC-010 | Squad summary in embed | Enable squad summary | Embed shows squad count, damage, DPS, downs, deaths |
| DISC-011 | Enemy summary in embed | Enable enemy summary | Embed shows enemy stats |
| DISC-012 | Enemy split by team | Enable enemy split | Separate sections per enemy team |
| DISC-013 | Top 10 lists in embed | Enable damage top 10 | Top 10 damage dealers listed in embed |
| DISC-014 | Class emoji display | Set class display to Emoji | Profession emojis shown next to player names |
| DISC-015 | Embed field count limit | Upload with all sections enabled | Embed respects 25 fields per embed, 10 max embeds |
| DISC-016 | Embed character limit | Upload with long player names | Embed stays under 6000 char limit |

### 9.3 Screenshot Mode

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| DISC-020 | Post screenshot to Discord | Trigger screenshot capture | PNG attachment posted to webhook |
| DISC-021 | Screenshot with dps.report link | Screenshot individual log | Image + permalink posted |
| DISC-022 | Stats dashboard screenshot | Screenshot stats view | Image posted without individual link |

---

## 10. Web Report Publishing

### 10.1 Upload Flow

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| WEB-001 | Upload web report | Click publish, confirm | WebUploadOverlay appears with progress stages |
| WEB-002 | Upload progress stages | Watch overlay during upload | Stages: Building → Uploading → Publishing |
| WEB-003 | Upload success | Complete upload | Overlay shows success, dismissible |
| WEB-004 | Upload failure | Mock git push failure | Overlay shows error details |
| WEB-005 | Dismiss overlay on completion | Click overlay after success | Overlay closes |
| WEB-006 | Report appears in index | Upload report, check Fight Reports | New report visible in report list |
| WEB-007 | GitHub Pages build status | After upload, check status | Build status polled and displayed |

### 10.2 Mock Web Report (Dev)

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| WEB-010 | Mock report preview | Trigger mock upload | Report previewed locally without pushing to GitHub |

---

## 11. Web Report Viewer (Standalone)

### 11.1 Report Loading

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| WRPT-001 | Report loads from URL | Navigate to `?report=test-report` | report.json fetched and rendered |
| WRPT-002 | Report loading indicator | Navigate to report URL | Loading spinner while fetching |
| WRPT-003 | Report not found | Navigate to non-existent report | Error message shown |
| WRPT-004 | Report with embedded data | Load pre-built report | Stats rendered from embedded JSON |

### 11.2 Navigation & Tabs

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| WRPT-010 | Tab navigation — Offensive | Click Offensive tab | Offensive stats section visible |
| WRPT-011 | Tab navigation — Defensive | Click Defensive tab | Defensive stats section visible |
| WRPT-012 | Tab navigation — Other Metrics | Click Other Metrics tab | Other metrics visible |
| WRPT-013 | Tab navigation — Overview | Click Overview tab | Overview section visible |
| WRPT-014 | Metrics spec search | Search in Proof-of-Work section | Search results shown, spec content filtered |
| WRPT-015 | Spec sidebar TOC | Click TOC heading in sidebar | Scrolls to corresponding section |

### 11.3 Theme Support

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| WRPT-020 | Theme loads from report data | Load report with "crt" palette | CRT theme CSS applied |
| WRPT-021 | All themes render correctly | Load report with each theme | No visual breakage per theme (Arcane, CRT, Matte, Kinetic, Electric Blue) |
| WRPT-022 | Theme CSS does not duplicate index.css | Inspect web theme CSS files | No `.stats-view` component rules duplicated |

### 11.4 Multi-Report Index

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| WRPT-030 | Index page loads | Navigate to index | List of all published reports shown |
| WRPT-031 | Open report from index | Click report in index | Report loads in viewer |
| WRPT-032 | Rollup aggregation | View rollup stats | Cross-report aggregate stats computed and displayed |

### 11.5 Responsive & Accessibility

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| WRPT-040 | Desktop layout | View at 1920×1080 | Full sidebar + content layout |
| WRPT-041 | Narrow viewport | View at 768px width | Layout adapts, sidebar collapses or stacks |
| WRPT-042 | Logo display | Report with custom logo | Logo shown in header area |
| WRPT-043 | External dps.report links | Click player dps.report link | Opens in new tab |

---

## 12. Modals & Overlays

### 12.1 How-To Modal

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| HT-001 | Open How-To | Click Help or How-To button | HowToModal opens |
| HT-002 | Navigation tree | Click topics in tree | Content area updates to show topic |
| HT-003 | Search topics | Type in search box | Topics filtered by search term |
| HT-004 | Breadcrumb navigation | Navigate deep into topics | Breadcrumbs show path, clickable |
| HT-005 | Close How-To | Click close or press Escape | Modal closes |

### 12.2 What's New Modal

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| WN-001 | Renders release notes | Open What's New | Formatted markdown release notes displayed |
| WN-002 | Version in header | Open What's New | Current version number shown |
| WN-003 | Scrollable content | Long release notes | Content scrolls within modal |
| WN-004 | Dismiss persists | Close What's New | Does not reappear until next version bump |

### 12.3 Webhook Modal

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| WM-001 | Lists existing webhooks | Open modal with 2 webhooks | Both webhooks listed with names |
| WM-002 | Add webhook form | Click "Add Webhook" | Name + URL input fields appear |
| WM-003 | Save new webhook | Fill form, click Save | Webhook added, list updated |
| WM-004 | Cancel add webhook | Click Cancel during add | Form cleared, no webhook added |
| WM-005 | Edit existing webhook | Click edit on webhook | Fields populated, editable |
| WM-006 | Delete webhook confirmation | Click delete | Confirmation prompt, then removal |

### 12.4 Update Error Modal

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| UE-001 | Error message displayed | Trigger update error | Error message shown in modal |
| UE-002 | Try Again button | Click Try Again | New update check initiated |
| UE-003 | Close button | Click Close | Modal closes |

---

## 13. Developer Features (Hidden)

### 13.1 Developer Settings Access

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| DEV-001 | Triple-click version | Triple-click version number in Settings | Developer settings section appears |
| DEV-002 | Dev settings hidden by default | Open Settings normally | No developer section visible |

### 13.2 Dev Datasets

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| DEV-010 | Open dev datasets modal | Click Dev Datasets in dev settings | DevDatasetsModal opens |
| DEV-011 | Save current state as dataset | Enter name, click Save | Dataset saved with logs + report + snapshot |
| DEV-012 | List saved datasets | Open modal | All saved datasets listed |
| DEV-013 | Load dataset | Click Load on a dataset | App state restored from dataset |
| DEV-014 | Delete dataset | Click Delete on a dataset | Dataset removed |
| DEV-015 | Chunked save progress | Save large dataset (many logs) | Progress indicator during streaming save |
| DEV-016 | Chunked load streaming | Load large dataset | Logs stream in chunks, progress shown |
| DEV-017 | Integrity check on load | Load dataset with corrupted data | Integrity failure detected, fallback offered |

### 13.3 Terminal (Console Viewer)

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| DEV-020 | Terminal opens | Open Terminal in dev settings | Console log viewer appears |
| DEV-021 | Live log streaming | Trigger main process activity | New log entries appear in real time |
| DEV-022 | Syntax highlighting | View logs | Tags, URLs, file paths, numbers highlighted |
| DEV-023 | Auto-scroll | New logs arrive | Terminal auto-scrolls to latest |
| DEV-024 | Clear logs | Click Clear | All logs removed from view |
| DEV-025 | 500-log history limit | Generate >500 logs | Oldest entries pruned |
| DEV-026 | Enable/disable forwarding | Toggle console log forwarding | Forwarding starts/stops |

### 13.4 Proof of Work

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| DEV-030 | Open proof of work modal | Click in dev settings | ProofOfWorkModal opens |
| DEV-031 | Hash validation | Run proof of work | Hash computation result displayed |

---

## 14. Error Handling & Recovery

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| ERR-001 | Error boundary catches render crash | Force component error | StatsErrorBoundary shows fallback UI |
| ERR-002 | Network offline — upload | Disconnect network, attempt upload | Upload fails gracefully, enters retry queue |
| ERR-003 | Network offline — details fetch | Disconnect network, fetch details | Error shown, retry available |
| ERR-004 | dps.report server error (500) | Mock 500 response | Upload retried with backoff |
| ERR-005 | dps.report rate limit (429) | Mock 429 response | 60-second cooldown applied |
| ERR-006 | Corrupted log file | Upload malformed .zevtc | Error categorized as "file", meaningful message |
| ERR-007 | GitHub API failure | Mock GitHub 500 | Error shown in settings, retry available |
| ERR-008 | IPC handler crash | Force IPC handler throw | Error surfaced to renderer, app stays stable |
| ERR-009 | Web Worker crash | Force worker error | Fallback to inline computation |
| ERR-010 | Stats sync/recovery | Open stats with partial data | Recovery banner shown, data synced |

---

## 15. Performance & Bulk Operations

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| PERF-001 | Bulk upload 10 files | Drop 10 .zevtc files | Max 3 concurrent uploads, all complete |
| PERF-002 | Bulk upload 30 files — no OOM | Drop 30 .zevtc files | App remains responsive, no V8 heap exhaustion |
| PERF-003 | Bulk mode animations disabled | Initiate bulk upload | Framer Motion animations bypassed |
| PERF-004 | Bulk mode backdrop-filter disabled | Initiate bulk upload | `body.bulk-uploading` class applied, backdrop blur off |
| PERF-005 | Stats aggregation ≤2s for 10 logs | Load 10 logs, compute stats | Aggregation completes in ≤2 seconds |
| PERF-006 | Tab switch latency ≤200ms | Switch between Dashboard and Stats | No perceivable delay (StatsView hidden, not unmounted) |
| PERF-007 | Log queue debounce during bulk | Upload 20 logs rapidly | UI updates batched every 60-80ms, no jank |
| PERF-008 | Aggregation cache hit | Recompute unchanged stats | 100% cache hit, instant result |
| PERF-009 | Parallel details hydration | Complete bulk upload | 3 concurrent detail fetches observed |
| PERF-010 | CSS containment on log cards | Scroll through 50+ log cards | Smooth scrolling (content-visibility: auto) |

---

## 16. Keyboard & Input Interactions

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| KEY-001 | Escape closes modals | Open any modal, press Escape | Modal closes |
| KEY-002 | Shift+click multi-select | Shift+click in file picker | Range selection applied |
| KEY-003 | Copy URL to clipboard | Click copy icon on dps.report link | URL copied, toast notification |

---

## 17. Data Persistence

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| PERS-001 | Logs persist across restart | Upload logs, restart app | Same logs appear on relaunch |
| PERS-002 | Settings persist across restart | Change settings, restart | Settings maintained |
| PERS-003 | Log directory persists | Set log directory, restart | Same directory configured |
| PERS-004 | Webhook list persists | Add webhooks, restart | Webhooks still configured |
| PERS-005 | GitHub auth persists | Authenticate, restart | Still authenticated |
| PERS-006 | Color palette persists | Set palette, restart | Same palette active |
| PERS-007 | Details cache persists | Fetch details, restart | Cache serves previously fetched details |
| PERS-008 | Clear DPS report cache | Click clear cache in settings | Cache cleared, progress shown, details re-fetched on next request |

---

## 18. Cross-Cutting Concerns

### 18.1 Theme Consistency

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| THM-001 | Electron and web share stats CSS | Compare stats rendering | `.stats-view` components identical across Electron and web |
| THM-002 | Web theme files — no duplication | Audit web theme CSS | No `.stats-view` rules duplicated from index.css |
| THM-003 | All palettes apply to all sections | Switch palette, view each section | No unstyled elements in any palette/section combo |

### 18.2 External Link Safety

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| EXT-001 | External links open in browser | Click any external URL | Opens in OS default browser, not in Electron |
| EXT-002 | No arbitrary URL execution | Attempt to open javascript: URL | Blocked or sanitized |

### 18.3 Image Fetching

| ID | Test | Steps | Expected |
|----|------|-------|----------|
| IMG-001 | Fetch image with redirect | Provide URL that 301-redirects | Final image fetched correctly |
| IMG-002 | Image size limit enforced | Provide oversized image URL | Fetch rejected, error shown |
| IMG-003 | Invalid image URL | Provide non-image URL | Error handled gracefully |

---

## Summary

| Category | Test Count |
|----------|-----------|
| App Lifecycle | 16 |
| Navigation | 8 |
| Dashboard | 28 |
| Upload Flow | 19 |
| File Picker | 11 |
| Stats View | 51 |
| Fight Report History | 15 |
| Settings | 56 |
| Discord Integration | 22 |
| Web Report Publishing | 8 |
| Web Report Viewer | 16 |
| Modals & Overlays | 16 |
| Developer Features | 17 |
| Error Handling | 10 |
| Performance | 10 |
| Keyboard & Input | 3 |
| Data Persistence | 8 |
| Cross-Cutting | 8 |
| **Total** | **~322** |

---

## Recommended Prioritization

### P0 — Critical Path (implement first)
- Upload flow (UPL-*), log card display (DASH-001 through DASH-011), Stats rendering (STAT-001 through STAT-006), Settings persistence (SET-001 through SET-003), Data persistence (PERS-*)

### P1 — Core Features
- All Stats sections (SEC-*), Discord integration (DISC-*), File picker (FP-*), Navigation (NAV-*), Error handling (ERR-*)

### P2 — Secondary Features
- Web report viewer (WRPT-*), Fight report history (FRH-*), GitHub Pages (GH-*, WEB-*), Modals (HT-*, WN-*, WM-*, UE-*)

### P3 — Polish & Edge Cases
- Performance (PERF-*), Developer features (DEV-*), Theme consistency (THM-*), Keyboard (KEY-*), Settings import/export (IMP-*), Embed settings (EMB-*, ETS-*)
