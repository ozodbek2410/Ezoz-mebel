import "@fastify/jwt";
import { type FastifyRequest } from "fastify";
import { prisma } from "../config/database";
import { type Server as SocketIOServer } from "socket.io";

export interface UserPayload {
  userId: number;
  role: string;
}

export interface Context {
  db: typeof prisma;
  user: UserPayload | null;
  io: SocketIOServer | null;
}

export function createContext(io: SocketIOServer | null) {
  return async ({ req }: { req: FastifyRequest }): Promise<Context> => {
    let user: UserPayload | null = null;

    try {
      const decoded = await req.jwtVerify<UserPayload>();
      user = decoded;
    } catch {
      // Not authenticated
    }

    return { db: prisma, user, io };
  };
}
