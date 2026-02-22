import { Server as SocketIOServer } from "socket.io";
import { type Server as HttpServer } from "http";

export function setupSocket(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    socket.on("join:room", (room: string) => {
      socket.join(room);
    });

    socket.on("leave:room", (room: string) => {
      socket.leave(room);
    });

    socket.on("disconnect", () => {
      // Client disconnected
    });
  });

  return io;
}
