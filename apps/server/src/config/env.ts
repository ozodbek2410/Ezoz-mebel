import "dotenv/config";

export const env = {
  DATABASE_URL: process.env["DATABASE_URL"] ?? "postgresql://postgres:2410@localhost:5432/ezoz_mebel",
  JWT_SECRET: process.env["JWT_SECRET"] ?? "ezoz-mebel-secret",
  PORT: Number(process.env["PORT"] ?? 3000),
  HOST: process.env["HOST"] ?? "0.0.0.0",
  UPLOAD_DIR: process.env["UPLOAD_DIR"] ?? "./uploads",
};
