# Free4All

**Free4All** is a fully automated sports-triggered deal alert app. It notifies users when their favorite sports teams win and a related free food promotion becomes available (e.g., “Dodgers win → free McFlurry at McDonald's”).

---

## 🔗 GitHub Repo
https://github.com/dougsimpsoncodes/Free4AllWeb

---

## 🧠 App Purpose

Free4All monitors sports game results and matches them to promotional food deals. It:

- Scrapes deal triggers from Reddit, brand websites, and fan blogs
- Tracks sports scores in real time (MLB, NBA, College Football, etc.)
- Matches win events to available deals
- Sends push notifications to subscribed users
- Includes an admin panel for managing deals and testing features
- Offers a “demo mode” to preview deals and test UI/UX

---

## ⚙️ Tech Stack

| Layer       | Stack                                 |
|-------------|----------------------------------------|
| Frontend    | React (TypeScript), Vite, TailwindCSS, shadcn/ui |
| Backend     | Node.js with Express-style services (in `server/`) |
| Auth        | Basic mock (Firebase planned)         |
| Storage     | Static data for now (Firestore planned) |
| Hosting     | Currently developed in Replit         |

---

## 🧩 Repo Structure

```
Free4AllWeb/
├── client/              # Frontend React app
│   └── src/
│       ├── components/  # UI components (DealCard, ActiveDealsShowcase, etc.)
│       ├── pages/       # Routes (landing.tsx, home.tsx)
│       └── hooks/       # Custom hooks
├── server/              # Node.js backend
│   ├── services/        # Deal scraping, game API processing, notifications
│   ├── routes.ts        # API routes
│   └── index.ts         # Server entrypoint
├── shared/              # Shared types & constants
├── public/              # Static assets
├── attached_assets/     # Screenshots, planning docs
└── README.md            # You are here
```

---

## 🛠️ Tasks for LLMs

If you're an AI coding assistant (like Claude, GPT-4o, or Gemini), you can help by:

1. Refactoring UI components for clarity and reusability
2. Improving backend scraping efficiency and flexibility
3. Adding new sports leagues (e.g., WNBA, NHL)
4. Designing scalable architecture for user subscriptions and notifications
5. Assisting with Firebase or Firestore integration
6. Ensuring best practices in TypeScript, React, and modular file structure

---

## 🧠 Developer Instructions

- All commits happen from Replit and are pushed to this GitHub repo
- If working with LLMs, refer to the file structure above and always include filenames
- Use `client/src/components/` for all reusable UI
- Use `server/services/` for backend logic
- Avoid prop drilling – use context or hooks if needed
- Real-time updates (via polling or sockets) are a future goal

---

## 🙋 Example Prompts You Can Use

> "Refactor `ActiveDealsShowcase.tsx` to be prop-driven."

> "Add a new scraping function for WNBA scores and results."

> "Design a Firebase Firestore schema for storing deals per team."

> "Write a backend route to return current deals grouped by sport."

---

## 📌 Current Status

- Development is in progress in Replit.
- GitHub serves as the source of truth for AI agents and external code assistants.
- Code is actively being pushed after every major edit.

---

## 👋 Maintained by

Doug Simpson – [dougsimpsoncodes](https://github.com/dougsimpsoncodes)
