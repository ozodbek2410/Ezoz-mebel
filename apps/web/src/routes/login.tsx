import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuthStore } from "@/store/auth.store";
import { trpc } from "@/lib/trpc";
import { Lock, User } from "lucide-react";
import toast from "react-hot-toast";

export function LoginPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuthStore();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate({ to: "/dashboard" });
    }
  }, [isAuthenticated, navigate]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) {
      toast.error("Login va parolni kiriting");
      return;
    }

    setLoading(true);
    try {
      const result = await trpc.auth.login.mutate({
        username: username.trim(),
        password,
      });

      // Get JWT token
      const tokenRes = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
      });
      const { token } = await tokenRes.json();

      login(
        {
          userId: result.userId,
          role: result.role,
          fullName: result.fullName,
          customPermissions: result.customPermissions,
        },
        token,
      );

      toast.success(`Xush kelibsiz, ${result.fullName}!`);
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login yoki parol noto'g'ri");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-600 rounded-2xl mb-4 shadow-lg shadow-brand-600/30">
            <span className="text-white font-bold text-2xl">EZ</span>
          </div>
          <h1 className="text-2xl font-bold text-white">EZOZ MEBEL</h1>
          <p className="text-blue-200/60 text-sm mt-1">Savdo Boshqaruv Tizimi</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
          <h2 className="text-lg font-semibold text-white mb-5">Tizimga kirish</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-blue-200/60 mb-1.5">Login</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-300/40" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Loginni kiriting"
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 pl-10 text-white placeholder:text-white/30 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                  autoFocus
                  autoComplete="username"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-blue-200/60 mb-1.5">Parol</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-300/40" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Parolni kiriting"
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 pl-10 text-white placeholder:text-white/30 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                  autoComplete="current-password"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary mt-6 py-3"
          >
            {loading ? "Kirish..." : "Tizimga kirish"}
          </button>
        </form>
      </div>
    </div>
  );
}
