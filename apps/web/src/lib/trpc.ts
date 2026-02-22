import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@ezoz/server/src/trpc/index";

function getAuthToken(): string | null {
  return localStorage.getItem("token");
}

export const trpc = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: "/trpc",
      headers() {
        const token = getAuthToken();
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
    }),
  ],
});

// For React Query integration
export type { AppRouter };
