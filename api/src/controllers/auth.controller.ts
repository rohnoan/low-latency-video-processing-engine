import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";

const JWT_SECRET = process.env.JWT_SECRET!;
if (!JWT_SECRET) {
  throw new Error("JWT secret key is missing");
}

/**
 * POST /auth/signup
 */
export const signup = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Validate
    if (!email || !password) {
      return res.status(400).json({ error: "email and password required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "password too short" });
    }

    // Check existing user
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existing) {
      return res.status(409).json({ error: "user already exists" });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user (explicit select)
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: "creator",
      },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });

    // Sign JWT
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: "1d" }
    );

    return res.status(201).json({
      token,
      user,
    });
  } catch (err) {
    console.error("signup error:", err);
    return res.status(500).json({ error: "internal server error" });
  }
};

/**
 * POST /auth/login
 */
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Validate
    if (!email || !password) {
      return res.status(400).json({ error: "email and password required" });
    }

    // Fetch user with required fields ONLY
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        role: true,
        passwordHash: true,
      },
    });

    if (!user) {
      return res.status(401).json({ error: "invalid credentials" });
    }

    // Compare password
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: "invalid credentials" });
    }

    // Sign JWT
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: "1d" }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("login error:", err);
    return res.status(500).json({ error: "internal server error" });
  }
};
