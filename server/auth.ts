import { Router } from "express";
import type { Request, Response } from "express";
import { sign, verify } from "jsonwebtoken";
import mysql from "mysql2/promise";

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || "ewf-emergency-secret-2026";
const JWT_EXPIRES_IN = "7d";

/**
 * Login endpoint
 * POST /api/auth/login
 * 
 * Body: { email: string, password: string }
 * Returns: { token: string, user: { id, name, email, role } }
 */
router.post("/auth/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Connect to database
    const conn = await mysql.createConnection(process.env.DATABASE_URL!);

    // Find user by email
    const [rows]: any = await conn.execute(
      "SELECT id, openId, name, email, role, phone, active, available FROM users WHERE email = ?",
      [email]
    );
    
    await conn.end();

    const user = rows[0];

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // For demo purposes, we're not checking password
    // In production, you would verify password hash here
    // For now, any password works if email exists

    // Generate JWT token
    const token = sign(
      {
        id: user.id,
        openId: user.openId,
        email: user.email,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      token,
      user: {
        id: user.id,
        openId: user.openId,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        active: user.active,
        available: user.available,
      },
    });
  } catch (error: any) {
    console.error("[Auth] Login error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get current user endpoint
 * GET /api/auth/me
 * 
 * Headers: Authorization: Bearer <token>
 * Returns: { id, name, email, role, phone, active, available }
 */
router.get("/auth/me", async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers["authorization"];
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.substring(7);
    
    // Verify JWT token
    const decoded: any = verify(token, JWT_SECRET);

    // Connect to database
    const conn = await mysql.createConnection(process.env.DATABASE_URL!);

    // Fetch fresh user data
    const [rows]: any = await conn.execute(
      "SELECT id, openId, name, email, role, phone, active, available FROM users WHERE id = ?",
      [decoded.id]
    );
    
    await conn.end();

    const user = rows[0];

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    res.json({
      id: user.id,
      openId: user.openId,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      active: user.active,
      available: user.available,
    });
  } catch (error: any) {
    console.error("[Auth] Get me error:", error);
    res.status(401).json({ error: "Invalid token" });
  }
});

/**
 * Logout endpoint
 * POST /api/auth/logout
 * 
 * Just returns success - token invalidation happens client-side
 */
router.post("/auth/logout", async (req: Request, res: Response) => {
  res.json({ success: true });
});

export default router;
