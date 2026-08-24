// Mocked calendar service for simplicity.
// In a real app, this would use googleapis and oauth2client with stored tokens.
export async function createCalendarEvent(doctorEmail: string, patientEmail: string, start: Date, end: Date, summary: string) {
  if (process.env.MOCK_CALENDAR === 'true') {
    console.log(`[MOCK CALENDAR] Event created for ${doctorEmail} & ${patientEmail} at ${start.toISOString()}`);
    return 'mock-event-id-' + Date.now();
  }
  // Provide a placeholder implementation
  return 'real-event-id';
}

export async function deleteCalendarEvent(eventId: string) {
  console.log(`[MOCK CALENDAR] Event ${eventId} deleted`);
}\n