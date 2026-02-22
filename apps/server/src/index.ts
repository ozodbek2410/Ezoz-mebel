import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import path from "path";
import { fileURLToPath } from "url";

import { env } from "./config/env";
import { appRouter } from "./trpc/index";
import { createContext } from "./trpc/context";
import { setupSocket } from "./socket/index";
import { uploadRoutes } from "./routes/upload";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const fastify = Fastify({
    logger: { level: "info" },
  });

  // CORS
  await fastify.register(cors, {
    origin: true,
    credentials: true,
  });

  // JWT
  await fastify.register(jwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: "24h" },
  });

  // JWT login endpoint (separate from tRPC for token generation)
  fastify.post("/api/login", async (request, reply) => {
    const { userId, role, fullName } = request.body as { userId: number; role: string; fullName: string };
    const token = fastify.jwt.sign({ userId, role });
    return reply.send({ token, userId, role, fullName });
  });

  // Multipart (file upload)
  await fastify.register(multipart, {
    limits: { fileSize: 50 * 1024 * 1024, files: 10 },
  });

  // Upload routes
  await fastify.register(uploadRoutes);

  // Static files for uploads
  await fastify.register(fastifyStatic, {
    root: path.resolve(env.UPLOAD_DIR),
    prefix: "/uploads/",
    decorateReply: false,
  });

  // Socket.io (attach to Fastify's underlying http.Server)
  const io = setupSocket(fastify.server);

  // tRPC
  await fastify.register(fastifyTRPCPlugin, {
    prefix: "/trpc",
    trpcOptions: {
      router: appRouter,
      createContext: createContext(io),
    },
  });

  // Serve frontend in production
  const webDistPath = path.resolve(__dirname, "../../web/dist");
  try {
    await fastify.register(fastifyStatic, {
      root: webDistPath,
      prefix: "/",
      decorateReply: false,
    });
  } catch {
    // Web dist may not exist in dev mode
  }

  // Start server
  try {
    await fastify.listen({ port: env.PORT, host: env.HOST });
    console.log(`Server running at http://${env.HOST}:${env.PORT}`);
    console.log(`tRPC endpoint: http://${env.HOST}:${env.PORT}/trpc`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();
