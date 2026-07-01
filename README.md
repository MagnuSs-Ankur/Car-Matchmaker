# 🚗 Car Matchmaker — AI-Powered Car Research Platform

> **Go from "I don't know what to buy" to "I'm confident about my shortlist" in under a minute.**

🌐 **Live Demo: [car-matchmaker-lemon.vercel.app](https://car-matchmaker-lemon.vercel.app)**

---

## What Did I Build, and Why?

Car buying is broken. A buyer walks into a decision space with 50+ options, complex spec sheets, and zero guidance. They either over-rely on biased dealer input, or spend hours on forums with no structured outcome.

**Car Matchmaker** is a conversational AI assistant that replaces the traditional filter-and-sort search model with a guided dialogue. A buyer types how they *feel* about their car needs — in plain language — and the system turns that into a confident shortlist with personalized explanations.

The core insight: **buyers don't think in specs, they think in situations.** "I need something safe for school runs, nothing too expensive" is a fundamentally different input format than dropdown menus for "body type: SUV, budget: $0–$40,000, safety rating: 4+". The AI bridges that gap.

### How it works: The 3-Stage Pipeline

The backend is deliberately **not** a black-box AI. It uses a hybrid approach that keeps the AI honest and the results deterministic:

```
User Prompt
    │
    ▼
┌─────────────────────────────────┐
│ Stage 1: LLM — Intent Parsing   │  "family, safe, under 40k" →
│ (Gemini)                        │  { budgetMax: 40000, safety: 0.9, ... }
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│ Stage 2: Algorithm — Scoring    │  Hard filters + weighted composite
│ (Our Code, lib/scoring.js)      │  score across all cars in dataset
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│ Stage 3: LLM — Refinement       │  Top candidates → Final 3 picks
│ (Gemini)                        │  with personalized reasoning
└─────────────────────────────────┘
```

The algorithm (Stage 2) runs on the full dataset every single time. Nothing is cached from previous results. This guarantees that when a user says "increase my budget to $90k" mid-conversation, the system re-scores all cars from scratch with the new constraints — not just filtering the previous output.

### Conversational Context

Each follow-up message benefits from two layers of context:
1. **Structured context**: The previously extracted preferences JSON is sent back to the LLM as a baseline, so changes like "make it cheaper" override only the `budgetMax` field while keeping all other constraints (seating, body type, priority weights) intact.
2. **Natural language context**: The last 6 turns of conversation history are included in the prompt, giving the LLM conversational awareness.

---

## What Did I Deliberately Cut?

| Cut Feature | Reason |
|---|---|
| **User authentication / accounts** | No time. Session-based shortlisting via browser cookies is sufficient to demo persistence. |
| **Real car database / API** | The dataset is a curated, representative car JSON file. A real integration (CarGurus API, Edmunds) would add auth, rate limits, and complexity that distracts from the core pipeline. |
| **Image assets for cars** | Adds scope. Placeholder spec cards communicate the same information. |
| **Price trends / depreciation data** | Out of brief scope. The brief asked for specs, mileage, safety, reviews — not market data. |
| **Mobile-responsive layout** | Deferred. The UI is desktop-first and usable on mobile but not optimized. |
| **Compare side-by-side view** | A natural next step, deliberately left for the "4 more hours" list. |
| **External database** | Replaced MongoDB Atlas with local JSON files. This eliminates ALL external service setup for the tester — zero friction to run. |

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| **Framework** | Next.js 15 (App Router) | Server Components by default, API routes co-located, zero config — ideal for full-stack POC in a time-box. |
| **AI** | Google Gemini (`gemini-1.5-pro` / configurable via `GEMINI_MODEL` env) | Strong JSON-mode support, generous free tier, fast response times for structured output. |
| **Database** | `data/cars.json` (read) + browser cookies (shortlist write) | `cars.json` is read-only so it works on Vercel's serverless filesystem. Shortlists are persisted in a secure `httpOnly` cookie — zero infra required. |
| **Styling** | Vanilla CSS (CSS Modules) | Maximum control. No framework lock-in. Scoped modules prevent style leakage. |
| **Fonts** | System font stack | Zero network overhead. Ships immediately. |

**Why not a real database?** The brief's biggest constraint is *"if we can't run it in under 2 minutes, it doesn't count."* Requiring Docker or an Atlas cluster connection adds a non-trivial setup surface. The JSON files are a pragmatic choice: they demonstrate genuine backend persistence (the shortlist file is read and written by the server), without forcing the tester to configure anything.

---

## What Did I Delegate to AI Tools vs. Do Manually?

### AI-Assisted (via Antigravity / LLM Pair Programmer)
- Initial boilerplate scaffolding (Next.js project setup, folder structure)
- First drafts of the CSS design system (dark mode variables, glassmorphism)
- The large prompt strings in `lib/ai.js`
- The 20-car JSON dataset (generated then manually reviewed for accuracy)
- Debugging sessions — e.g., the `cookies()` async breaking change in Next.js 15, the `Bad control character in JSON` parse error from a missing quote in the dataset

### Done Manually / Directed by Me
- **The 3-stage architecture decision** — the choice to sandwich the LLM with a deterministic algorithm was a deliberate design call, not generated
- **The `previousPreferences` delta pattern** — identifying that re-inferring from natural language history loses precision, and designing the structured baseline override, was manual reasoning
- **`lib/scoring.js` weighted scoring logic** — the normalization approach, the hard filter vs. soft weight separation, and the composite score formula
- **The conversational context strategy** — deciding which turns to include in history, how to format them, and what to truncate
- **All debugging diagnosis** — identifying root causes (stale closures, async cookie API, JSON syntax errors) before asking for fixes
- **All product/scope decisions** — what to cut, what the user journey should be, what "done" means

---

## Where Did AI Tools Help Most?

1. **Speed on boilerplate**: Setup, file creation, and first-draft CSS that would have taken 30–45 minutes took 2–3 minutes.
2. **Debugging known patterns**: The Next.js 15 `cookies()` async breaking change is a known issue. The AI caught it immediately and fixed all call sites in one pass.
3. **Dataset generation**: Getting realistic, varied car records with consistent schema structure was instant vs. manually researching and typing specs.
4. **CSS iteration**: Rapid changes to layout and animation without looking up syntax.

## Where Did They Get in the Way?

1. **JSON syntax errors in generated data**: The initial `cars.json` had a missing closing quote (`"seating: 5` instead of `"seating": 5`) that the AI introduced and didn't catch on generation. Required manual debugging.
2. **Tailwind PostCSS leftover**: The scaffolded project included a `postcss.config.mjs` for Tailwind that wasn't cleaned up. Caused a hard crash that looked unrelated.
3. **Over-confidence on architecture**: The first suggestion was to put all recommendation logic directly in the API route in a monolithic function. Required pushing back to enforce separation of concerns (`lib/ai.js`, `lib/scoring.js`).
4. **Mid-conversation preferences bug**: The AI didn't proactively identify that passing natural language history to the LLM for preference re-extraction would lose structured precision on mid-conversation changes. That diagnostic came from manual observation of the failure mode.

---

## If I Had Another 4 Hours

1. **Side-by-side comparison view** — Let the user pin 2–3 cars and see a structured spec-by-spec diff.
2. **Proper dataset** — Integrate a real car data API (Edmunds, CarGurus) with 100+ vehicles, including real images and MSRP ranges.
3. **Better shortlist UX** — Let users annotate saved cars ("liked the price but unsure about size"), enable export to PDF.
4. **Streaming responses** — Use Gemini's streaming API so the AI response types out progressively, making the chat feel more alive.
5. **"Explain this score" transparency** — Show the user a mini breakdown of why a car scored the way it did (safety weight was 0.9, this car scored 4.9/5 on safety = high contribution).
6. **Real persistence** — Move from JSON files to a proper lightweight DB (SQLite via Prisma, or Upstash Redis) and add session management with proper cookie handling.

---

## Screen Recording

> 🎥 **[Google Drive Link](https://drive.google.com/file/d/10X7573f0gVQBg2WKvdCw02m1_Gs9STjN/view?usp=sharing)**

---

## Run Instructions

**Requirements:** Node.js 18+, a Google Gemini API key (free at [aistudio.google.com](https://aistudio.google.com))

```bash
# 1. Clone the repo
git clone <repo-url>
cd car-matchmaker

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env.local
# Open .env.local and add your GEMINI_API_KEY

# 4. Run
npm run dev
```

Open `http://localhost:3000`. That's it. No Docker. No database setup.

### Environment Variables

```env
GEMINI_API_KEY=your_api_key_here   # Required — get free at aistudio.google.com
GEMINI_MODEL=gemini-3.5-flash        # Optional — defaults to gemini-3.5-flash
```

---

## Project Structure

```
├── app/
│   ├── api/
│   │   ├── recommend/route.js     # 3-stage pipeline API endpoint
│   │   └── shortlist/route.js     # Shortlist CRUD (persists to JSON file)
│   ├── shortlist/page.js          # Saved cars page
│   ├── globals.css                # Design system tokens
│   ├── page.js                    # Conversational chat interface
│   └── page.module.css            # Scoped chat UI styles
├── data/
│   ├── cars.json                  # 20-car dataset (the "database")
│   └── shortlists.json            # Persisted user shortlists (written by server)
└── lib/
    ├── ai.js                      # Gemini integration, prompt templates
    └── scoring.js                 # Deterministic weighted scoring algorithm
```
