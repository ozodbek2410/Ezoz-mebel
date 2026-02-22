import { type FastifyInstance } from "fastify";
import { randomUUID } from "crypto";
import { createWriteStream } from "fs";
import { mkdir } from "fs/promises";
import { unlink } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { pipeline } from "stream/promises";
import { env } from "../config/env";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function uploadRoutes(fastify: FastifyInstance) {
  fastify.post("/api/upload/product-image", async (request, reply) => {
    // Verify JWT
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const user = request.user as { userId: number; role: string };
    if (user.role !== "BOSS") {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: "Fayl yuklanmadi" });
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(data.mimetype)) {
      return reply.status(400).send({ error: "Faqat rasm fayllari (jpg, png, webp, gif) qabul qilinadi" });
    }

    const ext = path.extname(data.filename) || ".jpg";
    const fileName = `${randomUUID()}${ext}`;
    const uploadDir = path.resolve(env.UPLOAD_DIR, "products");

    await mkdir(uploadDir, { recursive: true });

    const filePath = path.join(uploadDir, fileName);
    await pipeline(data.file, createWriteStream(filePath));

    return { filePath: `/uploads/products/${fileName}` };
  });

  // Upload marketplace banner (replaces existing file in web/public/)
  fastify.post<{ Querystring: { name: string } }>("/api/upload/marketplace-banner", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const user = request.user as { userId: number; role: string };
    if (user.role !== "BOSS") {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const targetName = (request.query as { name?: string }).name;
    const validNames = ["reklama.webp", "reklama1.webp", "reklama2.webp", "reklama3.webp"];
    if (!targetName || !validNames.includes(targetName)) {
      return reply.status(400).send({ error: "Noto'g'ri banner nomi" });
    }

    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: "Fayl yuklanmadi" });
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(data.mimetype)) {
      return reply.status(400).send({ error: "Faqat rasm fayllari (jpg, png, webp) qabul qilinadi" });
    }

    const publicDir = path.resolve(__dirname, "../../../web/public");
    await mkdir(publicDir, { recursive: true });

    const filePath = path.join(publicDir, targetName);
    await pipeline(data.file, createWriteStream(filePath));

    return { success: true, fileName: targetName };
  });

  // Delete uploaded file
  fastify.delete("/api/upload/product-image", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const user = request.user as { userId: number; role: string };
    if (user.role !== "BOSS") {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const { filePath } = request.body as { filePath: string };
    if (!filePath || !filePath.startsWith("/uploads/products/")) {
      return reply.status(400).send({ error: "Noto'g'ri fayl yo'li" });
    }

    const fullPath = path.resolve(env.UPLOAD_DIR, filePath.replace("/uploads/", ""));
    try {
      await unlink(fullPath);
    } catch {
      // File may already be deleted
    }

    return { success: true };
  });
}
