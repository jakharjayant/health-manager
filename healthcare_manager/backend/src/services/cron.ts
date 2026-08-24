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
    await sendEmail(email, 'Medication Reminder', `Time to take your medication: ${r.medicationName}`);
    
    let next = new Date(now.getTime() + 24 * 60 * 60 * 1000); // daily
    if (r.frequency === 'Weekly') next = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    await prisma.medicationReminder.update({
      where: { id: r.id },
      data: { nextReminder: next }
    });
  }
  return { processed: reminders.length };
}\n