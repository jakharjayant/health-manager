# Healthcare Appointment & Follow-up Manager

This is a comprehensive healthcare appointment platform with a backend API (Express/Prisma) and a frontend (React/Vite).

## Features
- **Admin**: Create and manage doctors, view doctor lists, mark leave.
- **Patient**: Register, search for doctors, book appointments, submit symptoms.
- **Doctor**: View appointments, generate post-visit summaries, see LLM-powered pre-visit summaries.
- **LLM Integration**: Uses Gemini to analyze symptoms (pre-visit) and clinical notes (post-visit).
- **Concurrency**: Database constraints (unique on `doctorId, date, startTime`) prevent double booking.
- **Email/Calendar**: Integrates with Nodemailer and Google Calendar (Mocked by default for easy local running).

## Setup Guide

### Prerequisites
- Node.js (v18+)
- npm

### 1. Database & Backend Setup
1. Open terminal and navigate to \`backend\` directory:
   \`\`\`bash
   cd backend
   npm install
   \`\`\`
2. Configure `.env`:
   A `.env` file is already created. You can replace the \`GEMINI_API_KEY\` and other mock flags if you want to use the real APIs. By default, `MOCK_LLM`, `MOCK_EMAIL`, and `MOCK_CALENDAR` are set to `true` to allow the app to run without API keys.
3. Apply database schema (using SQLite for portability):
   \`\`\`bash
   npx prisma db push
   \`\`\`
4. Start the backend:
   \`\`\`bash
   npm run dev
   # Or using tsx directly: npx tsx src/index.ts
   \`\`\`

### 2. Frontend Setup
1. Open a new terminal and navigate to \`frontend\` directory:
   \`\`\`bash
   cd frontend
   npm install
   \`\`\`
2. Start the frontend:
   \`\`\`bash
   npm run dev
   \`\`\`

### 3. Usage
1. Open \`http://localhost:5173\`.
2. Register an Admin account (Role = Admin).
3. Register a Doctor account (Role = Doctor).
4. Register a Patient account (Role = Patient).
5. As an Admin, you can edit the doctor's details or mark them on leave.
6. As a Patient, you can book an appointment and enter your symptoms.
7. As a Doctor, you can view the appointment and generate a post-visit summary.

## Deliverables
- **DB Schema**: See \`backend/prisma/schema.prisma\`.
- **API Docs**: Standard REST paths (\`/api/auth\`, \`/api/admin\`, \`/api/patient\`, \`/api/doctor\`).
- **Google Calendar Setup**: To use the real Google Calendar API, you must provide \`GOOGLE_CLIENT_ID\` and \`GOOGLE_CLIENT_SECRET\` in the backend \`.env\`. Set \`MOCK_CALENDAR=false\` and implement the OAuth callback handler in \`src/services/calendar.ts\`.

## System Design

(See System Design write-up below)
