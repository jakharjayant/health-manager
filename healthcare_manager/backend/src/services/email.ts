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
    console.log(`[MOCK EMAIL] To: ${to} | Subject: ${subject} | ${text.substring(0,50)}...`);
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
}\n