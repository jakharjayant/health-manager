const fs = require('fs');
const path = require('path');

// 1. Update Prisma Schema to postgresql
const schemaPath = path.join(__dirname, 'backend', 'prisma', 'schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf-8');
schema = schema.replace(/provider\s*=\s*"sqlite"/, 'provider = "postgresql"');
fs.writeFileSync(schemaPath, schema);

// 2. Create vercel.json in backend
const vercelJsonPath = path.join(__dirname, 'backend', 'vercel.json');
const vercelJson = {
  "version": 2,
  "builds": [
    { "src": "src/index.ts", "use": "@vercel/node" }
  ],
  "routes": [
    { "src": "/(.*)", "dest": "src/index.ts" }
  ],
  "crons": [
    {
      "path": "/api/cron/reminders",
      "schedule": "0 * * * *"
    }
  ]
};
fs.writeFileSync(vercelJsonPath, JSON.stringify(vercelJson, null, 2));

// 3. Update backend/src/services/cron.ts to a callable function instead of node-cron
const cronServicePath = path.join(__dirname, 'backend', 'src', 'services', 'cron.ts');
const cronService = `
import { prisma } from '../db';
import { sendEmail } from './email';

export async function processMedicationReminders() {
  console.log('Running medication reminder job...');
  const now = new Date();
  const reminders = await prisma.medicationReminder.findMany({
    where: {
      status: 'PENDING',
      nextReminder: { lte: now }
    },
    include: {
      postVisitSummary: {
        include: {
          appointment: {
            include: { patient: true }
          }
        }
      }
    }
  });

  for (const r of reminders) {
    const email = r.postVisitSummary.appointment.patient.email;
    await sendEmail(email, 'Medication Reminder', \`Time to take your medication: \${r.medicationName}\`);
    
    let next = new Date(now.getTime() + 24 * 60 * 60 * 1000); // daily
    if (r.frequency === 'Weekly') next = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    await prisma.medicationReminder.update({
      where: { id: r.id },
      data: { nextReminder: next }
    });
  }
  return { processed: reminders.length };
}
`;
fs.writeFileSync(cronServicePath, cronService.trim() + '\\n');

// 4. Create cron route in backend
const cronRoutePath = path.join(__dirname, 'backend', 'src', 'routes', 'cron.ts');
const cronRoute = `
import { Router } from 'express';
import { processMedicationReminders } from '../services/cron';

const router = Router();

router.get('/reminders', async (req, res) => {
  // Simple protection for cron route (Vercel cron requests include a special header, or we can use a CRON_SECRET)
  // For simplicity, we'll allow it or check for CRON_SECRET env var.
  if (process.env.CRON_SECRET && req.headers.authorization !== \`Bearer \${process.env.CRON_SECRET}\`) {
     res.status(401).json({ error: 'Unauthorized' });
     return;
  }
  
  try {
    const result = await processMedicationReminders();
    res.json(result);
  } catch(e) {
    console.error(e);
    res.status(500).json({ error: 'Cron failed' });
  }
});

export default router;
`;
fs.writeFileSync(cronRoutePath, cronRoute.trim() + '\\n');

// 5. Update backend/src/index.ts to remove initCronJobs and export app
const indexTsPath = path.join(__dirname, 'backend', 'src', 'index.ts');
const indexTs = `
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

import authRoutes from './routes/auth';
import adminRoutes from './routes/admin';
import patientRoutes from './routes/patient';
import doctorRoutes from './routes/doctor';
import cronRoutes from './routes/cron';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/patient', patientRoutes);
app.use('/api/doctor', doctorRoutes);
app.use('/api/cron', cronRoutes);

// Vercel handles port assignment. Local dev defaults to 5000.
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(\`Server running on port \${PORT}\`);
  });
}

// Export the app for Vercel serverless functions
export default app;
`;
fs.writeFileSync(indexTsPath, indexTs.trim() + '\\n');

// 6. Update Frontend API URLs
const apiReplacer = (filePath) => {
  let content = fs.readFileSync(filePath, 'utf-8');
  content = content.replace(/http:\/\/localhost:5000\/api/g, '${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api');
  
  // Also we need to wrap the string in backticks instead of quotes if it's not already using backticks,
  // but since we just do a dumb replace, let's do a smarter approach:
  // Find axios.post('http://localhost:5000/api/auth/login'...) and change to backticks
  content = content.replace(/'http:\/\/localhost:5000\/api([^']+)'/g, "\`\\${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api$1\`");
  
  fs.writeFileSync(filePath, content);
}

const frontendPagesPath = path.join(__dirname, 'frontend', 'src', 'pages');
const pages = ['Login.tsx', 'Register.tsx', 'AdminDashboard.tsx', 'PatientDashboard.tsx', 'DoctorDashboard.tsx'];
pages.forEach(p => apiReplacer(path.join(frontendPagesPath, p)));

console.log('Successfully updated to Vercel Deploy Ready architecture.');
