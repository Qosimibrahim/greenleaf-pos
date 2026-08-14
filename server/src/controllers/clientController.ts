import { Response } from "express";
import { Client } from "../models/index.js";
import { AuthenticatedRequest } from "../middleware/auth.js";

export async function getClients(_req: AuthenticatedRequest, res: Response) {
  try {
    const clients = await Client.find().sort({ name: 1 });
    res.json(clients);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function createClient(req: AuthenticatedRequest, res: Response) {
  try {
    const client = await Client.create({
      ...req.body,
      createdBy: req.user?.id,
    });
    res.status(201).json(client);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function updateClient(req: AuthenticatedRequest, res: Response) {
  try {
    const client = await Client.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(client);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function deleteClient(req: AuthenticatedRequest, res: Response) {
  try {
    await Client.findByIdAndDelete(req.params.id);
    res.json({ message: "Client deleted" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}
