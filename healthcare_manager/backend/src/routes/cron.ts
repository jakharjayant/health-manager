import { Router } from 'express';
import { processMedicationReminders } from '../services/cron';

const router = Router();

router.get('/reminders', async (req, res) => {
  // Simple protection for cron route (Vercel cron requests include a special header, or we can use a CRON_SECRET)
  // For simplicity, we'll allow it or check for CRON_SECRET env var.
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
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

export default router;\n