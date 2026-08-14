import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/index.js";
import { JWT_SECRET } from "../config/env.js";
import { AuthenticatedRequest } from "../middleware/auth.js";

export async function signup(req: Request, res: Response) {
  const { email, password, fullName } = req.body;
  try {
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "User already exists" });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const user = await User.create({
      email,
      passwordHash,
      role: "admin",
      fullName: fullName || email.split("@")[0],
    });

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, {
      expiresIn: "7d",
    });

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        user_metadata: { full_name: user.fullName, demo_role: user.role },
      },
      access_token: token,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function signin(req: Request, res: Response) {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        user_metadata: { full_name: user.fullName, demo_role: user.role },
      },
      access_token: token,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export function getSession(req: Request, res: Response) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.json({ session: null });
  }

  jwt.verify(token, JWT_SECRET, async (err: any, payload: any) => {
    if (err) return res.json({ session: null });
    try {
      const user = await User.findById(payload.id);
      if (!user) return res.json({ session: null });
      res.json({
        session: {
          user: {
            id: user.id,
            email: user.email,
            user_metadata: { full_name: user.fullName, demo_role: user.role },
          },
          access_token: token,
        },
      });
    } catch {
      res.json({ session: null });
    }
  });
}

export async function getMe(req: AuthenticatedRequest, res: Response) {
  try {
    const user = await User.findById(req.user?.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function createUser(req: AuthenticatedRequest, res: Response) {
  const { email, password, role, full_name } = req.body;
  if (!email || !password || !full_name) {
    return res.status(400).json({ message: "Email, password, and full name are required" });
  }
  try {
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: "User already exists" });

    const passwordHash = bcrypt.hashSync(password, 10);
    const user = await User.create({
      email,
      passwordHash,
      role: role || "staff",
      fullName: full_name.trim(),
    });

    res.status(201).json({ id: user.id, email: user.email, fullName: user.fullName, role: user.role });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function getUsers(_req: AuthenticatedRequest, res: Response) {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    const formatted = users.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      fullName: u.fullName || u.email.split("@")[0],
      full_name: u.fullName || u.email.split("@")[0],
      createdAt: u.createdAt,
    }));
    res.json(formatted);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function deleteUser(req: AuthenticatedRequest, res: Response) {
  try {
    const targetUserId = req.params.id;
    if (targetUserId === req.user?.id) {
      return res.status(400).json({ message: "Cannot delete your own account" });
    }
    const deletedUser = await User.findByIdAndDelete(targetUserId);
    if (!deletedUser) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ message: "User deleted successfully", id: targetUserId });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}
