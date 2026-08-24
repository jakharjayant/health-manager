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

export default router;\n