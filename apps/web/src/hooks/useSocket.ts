import { useEffect } from "react";
import { getSocket, connectSocket, joinRoom, leaveRoom } from "@/lib/socket";

export function useSocket(rooms: string[] = []) {
  useEffect(() => {
    connectSocket();
    const socket = getSocket();

    for (const room of rooms) {
      joinRoom(room);
    }

    return () => {
      for (const room of rooms) {
        leaveRoom(room);
      }
    };
  }, [rooms.join(",")]);

  return getSocket();
}

export function useSocketEvent<T>(event: string, callback: (data: T) => void) {
  useEffect(() => {
    const socket = getSocket();
    socket.on(event, callback);
    return () => {
      socket.off(event, callback);
    };
  }, [event, callback]);
}
