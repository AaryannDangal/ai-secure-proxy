import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function requireApiKey(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const apiKey = req.headers["x-api-key"] as string | undefined;

  if (!apiKey) {
    res.status(401).json({ error: "Missing x-api-key header" });
    return;
  }

  const customer = await prisma.customer.findUnique({
    where: { apiKey },
  });

  if (!customer) {
    res.status(401).json({ error: "Invalid API key" });
    return;
  }

  // Rate limit check
  if (customer.requestsUsed >= customer.requestsLimit) {
    res.status(429).json({
      error: "Request limit reached",
      plan: customer.plan,
      limit: customer.requestsLimit,
    });
    return;
  }

  // Attach customer to request
  (req as any).customer = customer;
  next();
}

export async function incrementUsage(customerId: string): Promise<void> {
  await prisma.customer.update({
    where: { id: customerId },
    data: { requestsUsed: { increment: 1 } },
  });
}
