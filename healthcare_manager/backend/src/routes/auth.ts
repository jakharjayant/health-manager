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

export default router;\n