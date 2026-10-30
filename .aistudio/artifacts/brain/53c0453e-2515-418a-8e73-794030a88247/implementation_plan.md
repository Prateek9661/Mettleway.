# DevTrack: AI-Powered Learning Schedule & Study Squad Platform

A personalized study tracker and squad accountability platform designed for college students and self-learners to turn free online resources (like top YouTube playlists and syllabi) into structured, scheduled, and mentor-guided daily learning curricula without paying for expensive courses.

> [!IMPORTANT]
> **User Review & Confirmed Decisions from Phase 1:**
> - **Resource Extraction**: Smart AI extraction capable of parsing any YouTube link, playlist URL, course topic, or syllabus text into structured modules and lessons.
> - **Accountability Model**: Study Squads with daily streak tracking, peer milestone progress, and group leaderboards.
> - **Alerts & Scheduling**: In-app audio chimes, native browser notification alerts at the student's scheduled time, plus exportable `.ics` calendar schedules.

---

## 1. Overview & Core Concept

### What It Does
DevTrack bridges the gap between chaotic self-study (finding a 50-video DSA or Full-Stack YouTube playlist) and a disciplined, paid bootcamp experience. A student inputs a resource link (or chooses pre-curated premier tracks like Striver's A2Z DSA, Chai aur Code Full Stack, freeCodeCamp, etc.), sets their daily available study window (e.g., 8:00 PM – 9:30 PM) and pace. The platform:
1. Parses the entire curriculum into modules, lessons, estimated durations, and key concepts.
2. Generates an adaptive day-by-day timetable accounting for their free hours and rest days.
3. Fires scheduled session chime alerts and browser notifications when it's time to study.
4. Provides an **AI Learning Mentor** that summarizes previous days' knowledge retention, suggests practical code challenges, and answers doubts.
5. Links students into **Study Squads** where peers track streaks, celebrate milestones, and climb the consistency leaderboard.

### Target Audience & Persona
- College engineering students and self-taught developers preparing for software engineering roles.
- Study groups and campus coding clubs aiming for collective accountability.

### Key Value Delivered
- **Zero Cost, Maximum Discipline**: Free YouTube content converted into structured college-grade curriculums.
- **Time Management & Consistency**: Concrete daily video goals and scheduled alarms prevent procrastination.
- **Knowledge Retention**: Active AI summarization of past lessons and practical exercises reinforce concepts.

---

## 2. User Experience & Visual Design

### Key User Flows
1. **Onboarding / Quick Tracker Setup**:
   - Paste a YouTube playlist/video link or syllabus topic (e.g. "Complete DSA in C++ by Love Babbar", "Full Stack MERN Guide", or custom link).
   - Enter daily commitment (e.g. 60 mins/day), preferred study time (e.g. 19:30), and days per week.
   - AI generates the day-by-day schedule with total completion date, daily video targets, and milestone checkpoints.
2. **Daily Command Center**:
   - "Today's Study Session" card with active timer, scheduled time badge, and one-click "Launch Study Mode" (with integrated video player / external launcher).
   - Session countdown and real-time audio chime + desktop notification when study time arrives.
   - Quick "Mark Complete" toggle that updates daily streak, logs minutes studied, and reveals AI takeaways.
3. **AI Concept Mentor & Daily Review**:
   - "Yesterday's Recap": AI synthesizes what was learned over the past 3 days and highlights core conceptual links.
   - "Practical Challenge": AI generates hands-on coding exercises (e.g. "Implement Two-Pointer approach on LeetCode #167").
   - "Doubt Clearing Tutor": Interactive prompt box where students can ask any question about the current module and receive crystal-clear explanations with code snippets.
4. **Study Squads & Peer Leaderboard**:
   - Squad dashboard showing members' active streaks, today's completion status, velocity (hours studied), and shared milestone progress.
   - "Nudge" & "Cheer" interaction to keep peers accountable.
   - Squad invite link & code generation.
5. **Schedule Management & Calendar Export**:
   - Interactive weekly timetable and calendar view.
   - One-click `.ics` export for Google Calendar, Apple Calendar, and Outlook.

### Visual Identity & Theme
- **Aesthetic Direction**: High-focus, professional utilitarian student workspace with refined typography and crisp structural lines.
- **Color Palette & Discipline (60-30-10)**:
  - *Canvas (60%)*: Crisp clean slate/white (`#F8FAFC` light / `#0B0F19` dark mode).
  - *Structural Panels (30%)*: Muted surfaces (`#FFFFFF` light / `#111827` dark) with hairline borders (`#E2E8F0` / `#1F2937`).
  - *Accent Budget (10%)*: Electric Indigo (`#4F46E5` / `#6366F1`) for primary actions and active states; Emerald (`#10B981`) for completed streaks; Amber (`#F59E0B`) for session timers.
- **Typography**:
  - Display/Hero: `Plus Jakarta Sans` (font-semibold, tight tracking).
  - Body: `DM Sans` / `Plus Jakarta Sans` for high legibility.
  - Numbers, Dates & Timers: Tabular figures (`tabular-nums font-mono`).
- **Zero-Pill Restraint**: Metadata rendered with clean unboxed text and dot separators (`45 min · 3 lessons · LeetCode Medium`).

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Server-Side Gemini AI for Syllabus Parsing & Tutoring**
  - *Chosen Approach*: Use `@google/genai` on Express backend with `gemini-3.8-flash` to structure arbitrary YouTube URLs, playlists, and raw syllabi into consistent JSON curricula, generate recaps, and handle Q&A doubts.
  - *Why*: Eliminates fragile YouTube API quotas for users while enabling intelligent chapter splitting, time estimation, and concept mapping.
- **Decision 2: Client Persistence with LocalStorage + Squad Mock Synchronization**
  - *Chosen Approach*: Robust client-side state machine with LocalStorage persistence for user schedules, progress, notes, and streak history, with pre-populated active Squad peers and squad management.
  - *Why*: Instant zero-latency loading, complete offline resilience, and seamless out-of-the-box experience without mandatory user login obstacles.
- **Decision 3: Multi-Channel Alerts (Web Audio API + Notifications + ICS Export)**
  - *Chosen Approach*: Web Audio synthesis (warm melodic chime) combined with the standard browser Notification API and dynamic `.ics` calendar generation.
  - *Why*: Guarantees students receive alerts whether their browser tab is active or synced to their phone/desktop calendar.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        DevTrack Frontend (React + TS)                  │
├────────────────────────────────────────────────────────────────────────┤
│  Top Navigation (Brand · Tracker · Squads · Schedule · AI Mentor · ics)│
├───────────────────┬────────────────────────────┬───────────────────────┤
│   Sidebar / Tabs  │     Active View Engine     │    Alerts & Audio     │
│  - Active Track   │  - Daily Command Center    │  - Web Audio Chime    │
│  - Syllabus Tree  │  - Interactive Study Player│  - Browser Push Alert │
│  - Study Squad    │  - AI Recap & Doubt Tutor  │  - ICS File Exporter  │
│  - Calendar View  │  - Squad Leaderboard       │  - Focus Timer & Bell │
└─────────┬─────────┴─────────────┬──────────────┴───────────┬───────────┘
          │                       │                          │
          ▼                       ▼                          ▼
┌──────────────────┐    ┌──────────────────┐    ┌────────────────────────┐
│ Local State &    │    │ Express Backend  │    │ Gemini 3.8 Flash SDK   │
│ LocalStorage     │    │ /api/gemini/*    │───▶│ - Syllabus Extraction  │
│ - User Trackers  │    │ - /parse-resource│    │ - Daily Concept Recap  │
│ - Streaks & Log  │    │ - /generate-plan │    │ - Coding Challenges    │
│ - Squad Roster   │    │ - /concept-tutor │    │ - Doubt Q&A Assistant  │
└──────────────────┘    └──────────────────┘    └────────────────────────┘
```

### Key Data Entities
- **Tracker**: `id`, `title`, `sourceUrl`, `category`, `totalVideos`, `totalMinutes`, `dailyMinutesTarget`, `scheduledTime` (e.g. "20:00"), `restDays`, `createdAt`, `modules: Module[]`.
- **Module & Lesson**: `id`, `title`, `videoUrl`, `durationMinutes`, `completed`, `completedAt`, `notes`, `keyConcepts: string[]`.
- **StudySquad**: `id`, `name`, `track`, `members: SquadMember[]`, `dailyMilestone`, `announcements`.
- **DailyLog**: `date`, `trackerId`, `minutesStudied`, `lessonsCompleted`, `streakCount`, `aiSummary`.

---

## 5. Verification Plan

1. **Curriculum Creation & Extraction**: Verify pasting a YouTube link / selecting a preset generates valid lessons, estimated video runtimes, and daily breakdown.
2. **Scheduling & Alert Verification**: Set study time to current time + 1 minute; verify audio chime plays, visual alert activates, and test `.ics` export download.
3. **Progress & Streak Tracking**: Mark lessons complete; verify streak increases, completion percentage updates, and daily log records minutes.
4. **AI Recap & Doubt Tutor**: Verify request to `/api/gemini/concept-tutor` and `/api/gemini/daily-recap` returns structured summaries and code examples.
5. **Squad Accountability**: Verify joining/switching squads, cheering peers, and viewing velocity leaderboards.
