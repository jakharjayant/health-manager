const fs = require('fs');
const path = require('path');

const files = {
  'src/db.ts': `
import { PrismaClient } from '@prisma/client';
export const prisma = new PrismaClient();
  `,
  'src/services/llm.ts': `
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'mock' });

export async function generatePreVisitSummary(symptomsRaw: string) {
  if (process.env.MOCK_LLM === 'true') {
    return {
      urgencyLevel: 'Medium',
      chiefComplaint: 'Mocked complaint based on ' + symptomsRaw.substring(0, 20),
      questions: JSON.stringify(['How long has this lasted?', 'Is there pain?', 'Any other symptoms?'])
    };
  }
  
  const prompt = \`Analyse these symptoms and return JSON with keys: urgencyLevel (Low / Medium / High), chiefComplaint, and questions (array of exactly three suggested questions for the doctor). Symptoms: \${symptomsRaw}\`;
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });
    const txt = response.text || "{}";
    const data = JSON.parse(txt);
    return {
      urgencyLevel: data.urgencyLevel || 'Medium',
      chiefComplaint: data.chiefComplaint || 'Unknown',
      questions: JSON.stringify(data.questions || [])
    };
  } catch(e) {
    console.error("LLM Error", e);
    return { urgencyLevel: 'Medium', chiefComplaint: 'Failed to analyze', questions: '[]' };
  }
}

export async function generatePostVisitSummary(notesRaw: string) {
  if (process.env.MOCK_LLM === 'true') {
    return {
      patientSummary: 'Mocked summary based on notes.',
      medicationSchedule: 'Mocked schedule',
      followUpSteps: 'Mocked steps'
    };
  }
  const prompt = \`Convert these clinical notes into a patient-friendly summary. Return JSON with keys: patientSummary, medicationSchedule, followUpSteps. Notes: \${notesRaw}\`;
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });
    const data = JSON.parse(response.text || "{}");
    return {
      patientSummary: data.patientSummary || 'No summary',
      medicationSchedule: data.medicationSchedule || 'No schedule',
      followUpSteps: data.followUpSteps || 'No steps'
    };
  } catch(e) {
    console.error("LLM Error", e);
    return { patientSummary: 'Failed to generate', medicationSchedule: '', followUpSteps: '' };
  }
}
  `,
  'src/services/email.ts': `
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '2525'),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

export async function sendEmail(to: string, subject: string, text: string) {
  if (process.env.MOCK_EMAIL === 'true') {
    console.log(\`[MOCK EMAIL] To: \${to} | Subject: \${subject} | \${text.substring(0,50)}...\`);
    return;
  }
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      text
    });
  } catch (error) {
    console.error('Failed to send email:', error);
  }
}
  `,
  'src/services/calendar.ts': `
// Mocked calendar service for simplicity.
// In a real app, this would use googleapis and oauth2client with stored tokens.
export async function createCalendarEvent(doctorEmail: string, patientEmail: string, start: Date, end: Date, summary: string) {
  if (process.env.MOCK_CALENDAR === 'true') {
    console.log(\`[MOCK CALENDAR] Event created for \${doctorEmail} & \${patientEmail} at \${start.toISOString()}\`);
    return 'mock-event-id-' + Date.now();
  }
  // Provide a placeholder implementation
  return 'real-event-id';
}

export async function deleteCalendarEvent(eventId: string) {
  console.log(\`[MOCK CALENDAR] Event \${eventId} deleted\`);
}
  `,
  'src/services/cron.ts': `
import cron from 'node-cron';
import { prisma } from '../db';
import { sendEmail } from './email';

export function initCronJobs() {
  // Check for medication reminders every hour
  cron.schedule('0 * * * *', async () => {
    console.log('Running medication reminder cron...');
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
      
      // Update next reminder based on frequency (simplified logic)
      let next = new Date(now.getTime() + 24 * 60 * 60 * 1000); // assume daily for now
      if (r.frequency === 'Weekly') next = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      await prisma.medicationReminder.update({
        where: { id: r.id },
        data: { nextReminder: next }
      });
    }
  });
}
  `,
  'src/middleware/auth.ts': `
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'secret';

export const authMiddleware = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) { res.status(401).json({ error: 'Unauthorized' }); return; }
    try {
      const decoded = jwt.verify(token, SECRET) as { id: string; role: string };
      if (roles.length > 0 && !roles.includes(decoded.role)) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
      (req as any).user = decoded;
      next();
    } catch (e) {
      res.status(401).json({ error: 'Unauthorized' });
    }
  };
};
  `,
  'src/routes/auth.ts': `
import { Router } from 'express';
import { prisma } from '../db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const router = Router();
const SECRET = process.env.JWT_SECRET || 'secret';

router.post('/register', async (req, res) => {
  const { email, password, name, role } = req.body;
  try {
    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, passwordHash: hash, name, role }
    });
    if (role === 'DOCTOR') {
      await prisma.doctorProfile.create({
        data: {
          userId: user.id,
          specialization: 'General',
          workingHoursStart: '09:00',
          workingHoursEnd: '17:00',
          slotDurationMins: 30
        }
      });
    }
    res.json({ message: 'User registered' });
  } catch (e) {
    res.status(400).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  const token = jwt.sign({ id: user.id, role: user.role }, SECRET);
  res.json({ token, role: user.role, name: user.name });
});

export default router;
  `,
  'src/routes/admin.ts': `
import { Router } from 'express';
import { prisma } from '../db';
import { authMiddleware } from '../middleware/auth';
import { sendEmail } from '../services/email';

const router = Router();
router.use(authMiddleware(['ADMIN']));

router.get('/doctors', async (req, res) => {
  const doctors = await prisma.user.findMany({
    where: { role: 'DOCTOR' },
    include: { doctorProfile: true }
  });
  res.json(doctors);
});

router.put('/doctors/:id', async (req, res) => {
  const { specialization, workingHoursStart, workingHoursEnd, slotDurationMins } = req.body;
  await prisma.doctorProfile.update({
    where: { userId: req.params.id },
    data: { specialization, workingHoursStart, workingHoursEnd, slotDurationMins }
  });
  res.json({ message: 'Doctor updated' });
});

router.post('/doctors/:id/leave', async (req, res) => {
  const { date } = req.body; // YYYY-MM-DD
  const doctorId = req.params.id;

  try {
    await prisma.doctorLeave.create({
      data: { doctorId, date }
    });

    // Cancel affected appointments
    const affected = await prisma.appointment.findMany({
      where: { doctorId, date, status: { in: ['PENDING', 'BOOKED'] } },
      include: { patient: true }
    });

    for (const appt of affected) {
      await prisma.appointment.update({
        where: { id: appt.id },
        data: { status: 'CANCELLED' }
      });
      await sendEmail(appt.patient.email, 'Appointment Cancelled', 'The doctor is on leave.');
    }

    res.json({ message: 'Leave marked and appointments cancelled.' });
  } catch(e) {
    res.status(400).json({ error: 'Failed to mark leave. Might already exist.' });
  }
});

export default router;
  `,
  'src/routes/patient.ts': `
import { Router } from 'express';
import { prisma } from '../db';
import { authMiddleware } from '../middleware/auth';
import { generatePreVisitSummary } from '../services/llm';
import { sendEmail } from '../services/email';
import { createCalendarEvent } from '../services/calendar';

const router = Router();

// Allow public to list doctors, but require auth for booking
router.get('/doctors', async (req, res) => {
  const { specialization } = req.query;
  const doctors = await prisma.user.findMany({
    where: { role: 'DOCTOR', doctorProfile: specialization ? { specialization: String(specialization) } : undefined },
    include: { doctorProfile: true }
  });
  res.json(doctors);
});

router.use(authMiddleware(['PATIENT']));

router.post('/book', async (req, res) => {
  const patientId = (req as any).user.id;
  const { doctorId, date, startTime, endTime, symptomsRaw } = req.body;

  try {
    // Attempt to create appointment (unique constraint handles double booking!)
    // If we wanted 100% safety with hold, we'd use a transaction or status='PENDING'
    const appt = await prisma.appointment.create({
      data: { patientId, doctorId, date, startTime, endTime, status: 'BOOKED' },
      include: { patient: true, doctor: true }
    });

    // Generate Pre-Visit Summary asynchronously so it doesn't block
    generatePreVisitSummary(symptomsRaw).then(async (summaryData) => {
      await prisma.preVisitSummary.create({
        data: {
          appointmentId: appt.id,
          symptomsRaw,
          urgencyLevel: summaryData.urgencyLevel,
          chiefComplaint: summaryData.chiefComplaint,
          questions: summaryData.questions
        }
      });
    });

    // Notifications & Calendar
    sendEmail(appt.patient.email, 'Booking Confirmed', \`Your appointment on \${date} at \${startTime} is confirmed.\`);
    sendEmail(appt.doctor.email, 'New Booking', \`New appointment on \${date} at \${startTime}.\`);
    
    // Calendar event
    const eventId = await createCalendarEvent(appt.doctor.email, appt.patient.email, new Date(\`\${date}T\${startTime}\`), new Date(\`\${date}T\${endTime}\`), 'Healthcare Appointment');
    await prisma.appointment.update({ where: { id: appt.id }, data: { calendarEventId: eventId }});

    res.json(appt);
  } catch (e: any) {
    console.error(e);
    if (e.code === 'P2002') {
      res.status(409).json({ error: 'Slot is already booked.' });
    } else {
      res.status(500).json({ error: 'Booking failed.' });
    }
  }
});

router.get('/appointments', async (req, res) => {
  const patientId = (req as any).user.id;
  const appts = await prisma.appointment.findMany({
    where: { patientId },
    include: { doctor: true, preVisitSummary: true, postVisitSummary: true }
  });
  res.json(appts);
});

export default router;
  `,
  'src/routes/doctor.ts': `
import { Router } from 'express';
import { prisma } from '../db';
import { authMiddleware } from '../middleware/auth';
import { generatePostVisitSummary } from '../services/llm';
import { sendEmail } from '../services/email';

const router = Router();
router.use(authMiddleware(['DOCTOR']));

router.get('/appointments', async (req, res) => {
  const doctorId = (req as any).user.id;
  const appts = await prisma.appointment.findMany({
    where: { doctorId },
    include: { patient: true, preVisitSummary: true, postVisitSummary: true }
  });
  res.json(appts);
});

router.post('/appointments/:id/post-visit', async (req, res) => {
  const doctorId = (req as any).user.id;
  const { clinicalNotesRaw, medications } = req.body;
  const apptId = req.params.id;

  try {
    const appt = await prisma.appointment.findUnique({
      where: { id: apptId }, include: { patient: true }
    });
    if(!appt || appt.doctorId !== doctorId) { res.status(403).json({error: 'Forbidden'}); return; }

    const llmSummary = await generatePostVisitSummary(clinicalNotesRaw);

    const postVisit = await prisma.postVisitSummary.create({
      data: {
        appointmentId: apptId,
        clinicalNotesRaw,
        patientSummary: llmSummary.patientSummary,
        medicationSchedule: llmSummary.medicationSchedule,
        followUpSteps: llmSummary.followUpSteps
      }
    });

    if (medications && Array.isArray(medications)) {
      for (const m of medications) {
         await prisma.medicationReminder.create({
           data: {
             postVisitSummaryId: postVisit.id,
             medicationName: m.name,
             frequency: m.frequency,
             nextReminder: new Date(Date.now() + 24*3600*1000), // Default 1 day
             status: 'PENDING'
           }
         });
      }
    }
    
    await prisma.appointment.update({ where: { id: apptId }, data: { status: 'COMPLETED' }});
    sendEmail(appt.patient.email, 'Post-Visit Summary Available', 'Your doctor has added notes and a summary.');

    res.json(postVisit);
  } catch(e) {
    res.status(500).json({ error: 'Failed' });
  }
});

export default router;
  `,
  'src/index.ts': `
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

import authRoutes from './routes/auth';
import adminRoutes from './routes/admin';
import patientRoutes from './routes/patient';
import doctorRoutes from './routes/doctor';
import { initCronJobs } from './services/cron';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/patient', patientRoutes);
app.use('/api/doctor', doctorRoutes);

initCronJobs();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});
  `
};

for (const [filepath, content] of Object.entries(files)) {
  const fullpath = path.join(__dirname, filepath);
  fs.mkdirSync(path.dirname(fullpath), { recursive: true });
  fs.writeFileSync(fullpath, content.trim() + '\\n');
}
console.log('Files generated successfully.');
