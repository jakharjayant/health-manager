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

export default router;\n