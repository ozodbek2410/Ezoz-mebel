import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuthStore } from "@/store/auth.store";
import { trpc } from "@/lib/trpc";
import { Lock, User, Eye, EyeOff, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";

export function LoginPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuthStore();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({});
  const [touched, setTouched] = useState<{ username?: boolean; password?: boolean }>({});

  useEffect(() => {
    if (isAuthenticated) {
      navigate({ to: "/dashboard" });
    }
  }, [isAuthenticated, navigate]);

  function validate() {
    const newErrors: { username?: string; password?: string } = {};
    if (!username.trim()) {
      newErrors.username = "Login kiritilmadi";
    } else if (username.trim().length < 3) {
      newErrors.username = "Login kamida 3 belgi bo'lishi kerak";
    }
    if (!password) {
      newErrors.password = "Parol kiritilmadi";
    } else if (password.length < 4) {
      newErrors.password = "Parol kamida 4 belgi bo'lishi kerak";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleBlur(field: "username" | "password") {
    setTouched((t) => ({ ...t, [field]: true }));
    validate();
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ username: true, password: true });
    if (!validate()) return;

    setLoading(true);
    setLoginError("");
    try {
      const result = await trpc.auth.login.mutate({
        username: username.trim(),
        password,
      });

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
      const msg = err instanceof Error ? err.message : "Login yoki parol noto'g'ri";
      setLoginError(msg);
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
        <form onSubmit={handleLogin} className="bg-white/10 backdrop-blur-xl rounded-2xl p-5 sm:p-6 border border-white/10">
          <h2 className="text-lg font-semibold text-white mb-5">Tizimga kirish</h2>

          {loginError && (
            <div className="flex items-center gap-3 bg-red-500/20 border border-red-400/30 rounded-xl px-4 py-3 mb-4">
              <AlertCircle size={18} className="text-red-400 shrink-0" />
              <p className="text-red-200 text-sm">{loginError}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-blue-200/60 mb-1.5">Login</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-300/40" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); setLoginError(""); if (touched.username) validate(); }}
                  onBlur={() => handleBlur("username")}
                  placeholder="Loginni kiriting"
                  className={`w-full bg-white/10 border rounded-xl px-4 py-3 pl-10 text-white placeholder:text-white/30 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-colors ${
                    touched.username && errors.username ? "border-red-400" : "border-white/20"
                  }`}
                  autoFocus
                  autoComplete="username"
                />
              </div>
              {touched.username && errors.username && (
                <p className="text-red-400 text-xs mt-1.5">{errors.username}</p>
              )}
            </div>

            <div>
              <label className="block text-sm text-blue-200/60 mb-1.5">Parol</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-300/40" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setLoginError(""); if (touched.password) validate(); }}
                  onBlur={() => handleBlur("password")}
                  placeholder="Parolni kiriting"
                  className={`w-full bg-white/10 border rounded-xl px-4 py-3 pl-10 pr-10 text-white placeholder:text-white/30 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-colors ${
                    touched.password && errors.password ? "border-red-400" : "border-white/20"
                  }`}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-blue-300/40 hover:text-blue-300/70 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {touched.password && errors.password && (
                <p className="text-red-400 text-xs mt-1.5">{errors.password}</p>
              )}
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
