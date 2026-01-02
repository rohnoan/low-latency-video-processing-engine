import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  user?: { id: string; role: "admin" | "creator" };
}

export const auth = (roles?: Array<"admin" | "creator">) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header) return res.status(401).json({ error: "missing token" });

    const token = header.split(" ")[1];
    if (!token) return res.status(401).json({ error: "invalid token" });

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as any;
      req.user = { id: payload.userId, role: payload.role };

      if (roles && !roles.includes(req.user.role)) {
        return res.status(403).json({ error: "forbidden" });
      }

      next();
    } catch {
      return res.status(401).json({ error: "invalid token" });
    }
  };
};
