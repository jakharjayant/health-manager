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
    sendEmail(appt.patient.email, 'Booking Confirmed', `Your appointment on ${date} at ${startTime} is confirmed.`);
    sendEmail(appt.doctor.email, 'New Booking', `New appointment on ${date} at ${startTime}.`);
    
    // Calendar event
    const eventId = await createCalendarEvent(appt.doctor.email, appt.patient.email, new Date(`${date}T${startTime}`), new Date(`${date}T${endTime}`), 'Healthcare Appointment');
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

export default router;\n