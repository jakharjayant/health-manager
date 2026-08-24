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
};\n