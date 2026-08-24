# System Design: Healthcare Appointment & Follow-up Manager

## 1. Concurrency & Double Booking Prevention
In healthcare systems, it is critical to prevent double-booking. When multiple patients attempt to book the same doctor at the same time, the system must enforce strict concurrency controls.
- **Database Level Enforcement**: In this design, we use a Prisma-enforced \`@@unique([doctorId, date, startTime])\` constraint on the \`Appointment\` model. This ensures that the database engine itself rejects any secondary insert attempting to claim the exact same time slot for the same doctor.
- **Handling Race Conditions**: When an insert fails due to a \`P2002\` unique constraint violation, the backend catches this specific error code and returns a \`409 Conflict\` to the client, gracefully informing them that the slot was just taken.
- **Slot Holds (Future Enhancement)**: While strict constraints are sufficient for immediate bookings, a high-traffic system could implement a "Slot Hold" mechanism. We would insert an appointment with status \`PENDING\` and an \`expiresAt\` timestamp. A background job (or TTL index) would clear expired holds.

## 2. Doctor Leave Conflict Handling
Doctors occasionally need to take emergency leaves. When a doctor (or admin) marks a day as "Leave":
1. **Creation**: A \`DoctorLeave\` record is inserted to block future bookings for that date.
2. **Impact Analysis**: The system immediately queries all \`PENDING\` and \`BOOKED\` appointments for that doctor on the given date.
3. **Resolution**: A transaction updates the status of all affected appointments to \`CANCELLED\`. 
4. **Notification**: The system dispatches an email to all affected patients explaining the cancellation and prompting them to reschedule.

## 3. Asynchronous LLM Processing & Failure Handling
Integrating LLMs (like Gemini) introduces latency and potential reliability issues. 
- **Pre-Visit Summary**: When a patient submits symptoms, the booking transaction is completed *first* to secure the slot and provide immediate feedback to the patient. The LLM processing runs asynchronously (using \`.then()\`). If the LLM request fails, a fallback summary is generated so the system continues to function.
- **Post-Visit Summary**: The doctor requests a summary after the visit. This is awaited synchronously to provide immediate UI feedback to the doctor.
- **Graceful Degradation**: If the API rate limits are hit or the service is down, the LLM wrapper catches the exception and returns a generic fallback (e.g., "Failed to analyze symptoms"). This ensures the core appointment system never breaks due to an external AI service failure.

## 4. Notification & Background Jobs Reliability
- **Medication Reminders**: A \`node-cron\` job runs periodically (e.g., every hour) to scan the \`MedicationReminder\` table for records where \`nextReminder\` is in the past and \`status\` is \`PENDING\`. 
- **Idempotency & Retries**: Once an email is successfully dispatched via Nodemailer, the reminder's \`nextReminder\` is pushed forward (e.g., +24 hours for daily medication). If the email fails, the cron job simply picks it up on the next tick, inherently providing a retry mechanism.
- **Email/Calendar Delivery**: For a production environment, sending emails synchronously in an API route is risky. We recommend decoupling this using a message queue (e.g., BullMQ or AWS SQS). A dedicated worker would consume the queue, allowing for exponential backoff and retry policies without blocking HTTP requests.
