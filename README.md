<div align="center">

# 🚀 DevTrack — Smart Self-Study Workspace & AI Concept Mentor

**Turn any YouTube playlist, lecture video, or Computer Science syllabus into an actionable daily study schedule, interactive task checklist, and 1-on-1 AI Concept Mentor.**

[![Live Demo](https://img.shields.io/badge/Live_Demo-Online-10B981?style=for-the-badge&logo=vercel&logoColor=white)](https://devtrack.ukprateek9661.workers.dev)
[![React 19](https://img.shields.io/badge/React-19.0-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.2-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4.0-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Gemini API](https://img.shields.io/badge/Google_Gemini_API-@google/genai-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)
[![Tests](https://img.shields.io/badge/Tests-28%2F28_Passing-22C55E?style=for-the-badge&logo=nodejs&logoColor=white)](#testing--tdd-suite)

[🌐 **View Live Demo**](https://mettleway.pks-hq.workers.dev/) · [✨ **Key Features**](#-key-features) · [🛠️ **Tech Stack**](#️-tech-stack) · [⚡ **Local Setup**](#-local-setup--installation) · [📸 **Screenshots**](#-screenshots)

</div>

---

## 📖 Overview

**Mettleway. (`Mettleway-learner App`)** is a full-stack developer learning platform and daily study task tracker built for students, self-taught engineers, and interview candidates mastering **Data Structures & Algorithms (DSA)**, **DBMS & SQL**, **Operating Systems**, **Computer Networks**, **Full-Stack Web Development**, **Python**, and **System Design**.

While platforms like YouTube offer world-class engineering playlists, learners often struggle with **unstructured binge-watching**, **lack of daily task tracking**, and **getting stuck on complex concepts without a mentor**. DevTrack solves this by transforming any YouTube playlist or course topic into a structured day-by-day curriculum with direct lecture navigation, a distraction-free **Deep Work** focus timer, a dual-mode **AI Concept Mentor** (*Professor Mode* & *Technical Interviewer Mode*), peer **Study Squads**, and **RFC 5545 `.ics` Calendar Synchronization**.

---

## 🌐 Live Demo

🔗 **Live Application:** [**https://mettleway.pks-hq.workers.dev/**](https://mettleway.pks-hq.workers.dev/)

---

## ✨ Key Features

### 1. 🎯 Dynamic YouTube Course & Playlist Importer
- **Smart Playlist & Video Extraction:** Paste any YouTube playlist link (`youtube.com/playlist?list=...`), the first video of a playlist (`youtube.com/watch?v=...&list=...`), or a single long-form course video alongside your subject name (e.g., `DBMS`, `OS`, `Python`, `Striver's A2Z DSA`).
- **Dynamic Header & Theme Adaptation:** Automatically updates dashboard titles, category badges, instructor attributions, and visual theme tokens (`DSA`, `DBMS & SQL`, `Operating Systems`, `Computer Networks`, `AI & ML`, `Web Development`, `System Design`).
- **Direct Lecture Navigation:** Binds each sequential lesson (`Lesson 1`, `Lesson 2`, `Lesson 3`, etc.) directly to its exact YouTube playlist index (`&index=N` + video ID) or lecture timestamp (`&t=1800s`).

### 2. ✅ Interactive Learner Study Desk & Daily Task Checklist
- **Curriculum-Synced Daily Checklist:** Automatically pairs today's assigned video lecture, hands-on coding exercise, and revision note goals with your personal custom study tasks.
- **Circular Focus Session Timer:** Track daily study minutes against your target commitment (`30m` – `150m/day`) with Web Audio melodic chimes, desktop notifications, and milestone confetti celebrations.

### 3. 🛡️ Distraction-Free 'Deep Work' Mode
- **One-Click Focus Toggle:** Toggle **Deep Work** directly from the top navigation bar to hide non-essential navigation tabs (`Study Roadmap`, `Study Squads`, `Schedule & Sync`), collapse secondary utility bars, and expand the active study session and checklist.

### 4. 🎓 Dual-Mode AI Concept Mentor (Powered by Gemini API)
- **Professor Mode (Beginner Friendly):** Explains tough CS concepts like a warm university professor teaching a first-year student—complete with relatable **Real-World Examples**, plain-English whiteboard walkthroughs, and beginner-friendly code.
- **Technical Interviewer Mode (FAANG / Tech Interview Ready):** Reveals the **exact question interviewers ask**, the **structured approach they expect** (brute-force to optimal progression + edge cases), classic **follow-up trap questions**, and optimal code with **line-by-line explanations**.
- **Two-Tier Instant Caching:** Combines client-side `localStorage` caching (`0ms` instant recall for previously cleared doubts) with server-side in-memory caching and a resilient fallback engine for guaranteed sub-second responsiveness.

### 5. 👥 Peer Accountability Study Squads
- Create or join cohort **Study Squads** using invite codes (e.g., `DSA-2025`), track weekly study leaderboards, view live teammate progress, and send cheers or study nudges.

### 6. 📅 Scheduled Audio Alarms & RFC 5545 `.ics` Calendar Sync
- Export upcoming curriculum lessons or recurring weekly study habits as standards-compliant **RFC 5545 `.ics` calendar files** with `VALARM` reminders, or add sessions via one-click deep links to **Google Calendar** and **Microsoft Outlook**.

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend Framework** | **React 19** + **TypeScript** | Modular, type-safe component architecture & reactive state management |
| **Build Tool & Bundler** | **Vite 6** | Fast development workflow and optimized production bundling |
| **Styling & UI** | **Tailwind CSS v4** + **Lucide React** | Responsive, accessible Learner Study Desk interface with dynamic course themes |
| **Backend Runtime** | **Node.js** + **Express** (`server.ts`) | API proxy routes, YouTube `ytInitialData` / oEmbed scraping, and static crawler file serving |
| **AI Integration** | **Google Gemini API** (`@google/genai`) | Curriculum structuring, daily learning recaps, and dual-mode Concept Mentor (`gemini-3.1-flash-lite`) |
| **Audio & Calendar** | **Web Audio API** + **RFC 5545 iCalendar** | Synthesized melodic study chimes and `.ics` calendar generation |
| **Testing (TDD)** | **Node.js Test Runner** (`node:test`) + **TSX** | 28 automated Unit & Integration tests verifying pure domain logic and live API endpoints |

---

## 📸 Screenshots

> _Replace the placeholders below with actual screenshots or GIF captures of your running DevTrack workspace._

| **Today's Study Desk & Daily Task Tracker** | **Deep Work Distraction-Free Mode** |
| :---: | :---: |
| ![Today's Study Session Placeholder](https://via.placeholder.com/800x450/F8FAFC/4F46E5?text=DevTrack+-+Today%27s+Study+Session+%26+Daily+Task+Checklist) | ![Deep Work Mode Placeholder](https://via.placeholder.com/800x450/0F172A/818CF8?text=DevTrack+-+Deep+Work+Focus+Mode) |
| *Interactive daily task checklist, focus timer, and direct YouTube lecture navigation.* | *Minimalist focus bar hiding non-essential tabs for uninterrupted study.* |

| **AI Concept Mentor (Professor & Interviewer Modes)** | **Dynamic Course Importer & Curriculum Roadmap** |
| :---: | :---: |
| ![AI Concept Mentor Placeholder](https://via.placeholder.com/800x450/F8FAFC/059669?text=DevTrack+-+AI+Concept+Mentor+%28Professor+%26+Interviewer+Modes%29) | ![Curriculum Roadmap Placeholder](https://via.placeholder.com/800x450/F8FAFC/0D9488?text=DevTrack+-+Dynamic+Playlist+Importer+%26+Study+Roadmap) |
| *Real-world analogies, interviewer expectations, and line-by-line code explanations.* | *Sequential module tracking with direct links to each lecture video.* |

---

## 📂 Project Structure

```text
devtrack/
├── public/
│   ├── robots.txt                     # Search engine crawler rules
│   └── sitemap.xml                    # XML sitemap for SEO indexing
├── src/
│   ├── components/
│   │   ├── Navbar.tsx                 # Top navigation bar with Deep Work toggle
│   │   ├── TodaySession.tsx           # Active study session, daily checklist, timer & playlist lectures
│   │   ├── CurriculumRoadmap.tsx      # Full module & lesson syllabus with direct lecture links
│   │   ├── AIMentorView.tsx           # 1-on-1 Professor Mode & Technical Interviewer Mode mentor
│   │   ├── CreateTrackerModal.tsx     # YouTube playlist/video & custom subject course importer
│   │   ├── StudySquadsView.tsx        # Peer accountability cohorts & leaderboards
│   │   ├── ScheduleAlertsView.tsx     # Daily alarms & RFC 5545 .ics calendar export
│   │   └── ConfettiCelebration.tsx    # Milestone completion modal
│   ├── utils/
│   │   ├── studyWorkspaceLogic.ts     # Pure domain logic (playlist parsing, dynamic headers, tasks, Deep Work)
│   │   ├── aiMentorCache.ts           # Client cache & smart Professor/Interviewer fallback engine
│   │   ├── calendarExport.ts          # RFC 5545 .ics generator & Google/Outlook deep links
│   │   ├── audioAlert.ts              # Web Audio API chime synthesizer & notification helper
│   │   ├── mockPresets.ts             # Default starter tracks & study squads
│   │   ├── devtrack.unit.test.ts      # TDD Unit Test Suite
│   │   └── devtrack.integration.test.ts # End-to-End & Live Server Integration Test Suite
│   ├── types.ts                       # TypeScript interfaces for Trackers, Modules, Lessons, Tasks, and AI responses
│   ├── App.tsx                        # Main application state & view router
│   └── main.tsx                       # React 19 DOM entry point
├── index.html                         # SEO-optimized HTML entry with OpenGraph & JSON-LD schema
├── server.ts                          # Express + Vite full-stack server & Gemini API routes
├── package.json                       # Scripts and dependencies
└── tsconfig.json                      # TypeScript configuration
```

---

## ⚡ Local Setup & Installation

Follow these steps to run **Mettleway.** locally on your machine:

### Prerequisites
- **Node.js** `v18.18+` or `v20+`
- **npm** `v9+`
- A **Google Gemini API Key** 

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/devtrack.git
cd devtrack
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Create a `.env` file in the root directory (you can copy `.env.example`):
```bash
cp .env.example .env
```
Add your Gemini API key inside `.env`:
```env
GEMINI_API_KEY=your_gemini_api_key_here
PORT=3000
```

### 4. Start the Development Server
```bash
npm run dev
```
Open [**http://localhost:3000**](http://localhost:3000) in your browser. Both the Express API (`/api/*`) and the Vite React frontend are served on port `3000`.

---

## 🧪 Testing & TDD Suite

DevTrack follows strict **Test-Driven Development (TDD)** with comprehensive Unit and Integration tests using Node's built-in test runner (`node:test`) and `tsx`.

```bash
# Run all Unit and Integration tests
npm test

# Run TypeScript typechecking
npm run lint

# Build for production
npm run build
```

---

## 📄 License

Distributed under the **MIT License**. Built with focus and consistency for lifelong learners and developers.
