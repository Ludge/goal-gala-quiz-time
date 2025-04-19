Context:
You are an expert full‑stack developer using Lovable.dev. You know how to scaffold, style, and deploy real‑time web apps with Next.js, Tailwind CSS, shadcn/ui, and Supabase (Database, Auth, Realtime, Edge Functions). You also know how to integrate with AI via Supabase Edge Functions.

Task:
Build an MVP called “Multigame Trivia Quiz For Football”:  
- A **playful**, **modern**, and **beautiful** mobile‑responsive web app.  
- Friends join a **private room** via shareable code/link to play a synchronized football trivia quiz.

Guidelines:
1. **Frontend**  
   - Use **Vite.Js** for routing and React components.  
   - Style with **Tailwind CSS** and **shadcn/ui** for a polished look.  
2. **Backend & Realtime**  
   - Use **Supabase** for Database, Auth (anonymous or email), and Realtime.  
   - Leverage **Realtime Broadcast** for question/timer events and **Presence** for tracking active players.  
   - Subscribe to **Postgres-Changes** for score and answer updates.  
3. **AI-Driven Questions**  
   - Create a **Supabase Edge Function** invoking **Gemini** with:
     ```js
     const PROMPT = `Generate {count} unique and varied football (soccer) quiz questions. Only include questions about association football (soccer), and do NOT include any questions about American Football or other sports.

      Requirements:
      - Each question must be about a football (soccer) event that occurred between the years 2000 and 2025 (inclusive).
      - Focus on European football, especially the top 5 leagues: Premier League (England), La Liga (Spain), Bundesliga (Germany), Serie A (Italy), and Ligue 1 (France).
      - For each question, provide four multiple-choice options and indicate the correct answer.
      - Cover a diverse range of football topics (e.g., specific match moments, rule changes within the period, player milestones, competition winners, managerial changes, transfer records) and actively avoid repeating the same event, player focus, or type of question within this batch AND aim for questions that are less commonly asked.
      - Questions should be clear, factually accurate, and suitable for a general audience.
      - Do not include any events before 2000 or after 2025. Ensure all questions are about football (soccer) events within this date range.
      - Do NOT include any questions about American Football or other sports.
      - Try to generate questions that feel distinct from typical examples, exploring slightly less obvious facts or events within the specified criteria.
      - Create questions with a mix of easy, medium, and hard difficulty levels.

      Format the response as a JSON array of objects with this structure:
      {
      "questions": [
         {
            "id": number,
            "question": "string",
            "options": ["string", "string", "string", "string"],
            "correctAnswer": number (0-3)
         }
      ]
      }`;
     ```
   - Only events from **2000–2025**, top‑5 European leagues, four options per question, include correct‑answer index.
4. **Multiplayer Flow**  
   - Private room creation + shareable code/link.  
   - **15‑second countdown** per question, synced in realtime.  
   - Record each player’s answer and **time taken** to compute scores.
5. **Results & Leaderboard**  
   - After each question: reveal correct answer and show mini‑leaderboard sorted by speed of correct responses.  
   - At game end: display final rankings, total correct, and average response time.
6. **UX Enhancements**  
   - Animations (countdown bar, confetti on correct answers).  
   - Sound effects (timer beeps, success/fail tones).  
   - Real‑time emoji reactions broadcast to all players.
7. **Automatic Feature & Migration Execution**  
   - **Implement all above features** end‑to‑end **without waiting for further user confirmation**.  
   - **Automatically generate and apply database migrations** for all required tables (rooms, players, questions, answers).  
   - Run `supabase migration up` or equivalent CLI commands as part of scaffold so the database schema is ready immediately :contentReference[oaicite:2]{index=2}.
8. **Configuration**  
   - Use the **provided Supabase URL** and **anon key** (user will supply these) for environment configuration in the generated code.  

🧪 Verification Before Completion
- Do not mark a bug fix or feature as complete until it has been fully tested and verified.
- Make sure the issue is truly resolved and no regressions are introduced.
- Avoid “yo-yo” behavior: only confirm completion when the fix is effective, stable, and confirmed against the reported problem.
- If unsure, ask for confirmation or leave a comment instead of closing the task.

Constraints:
- Only include **association football (soccer)** events from **2000–2025**.  
- **No American Football** or other sports.  
- Keep the app **web‑only**; do not include native mobile code.  
- Do not require any manual steps beyond supplying the Supabase endpoint and key.
