import { useState, useEffect } from "react";
import { type FormEvent } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";

const roleRedirects: Record<string, string> = {
  admin: "/admin",
  teacher: "/teacher",
  checker: "/checker",
  teacher_checker: "/teacher",
  rechecking: "/recheck",
};

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = "OSM — Login";
  }, []);

  const validateEmail = (value: string) => {
    if (!value.trim()) {
      setFieldErrors((prev) => ({ ...prev, email: "Email address is required" }));
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setFieldErrors((prev) => ({ ...prev, email: "Please enter a valid email address" }));
      return false;
    }
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.email;
      return next;
    });
    return true;
  };

  const validatePassword = (value: string) => {
    if (!value.trim()) {
      setFieldErrors((prev) => ({ ...prev, password: "Password is required" }));
      return false;
    }
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.password;
      return next;
    });
    return true;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError("");

    const emailValid = validateEmail(email);
    const passwordValid = validatePassword(password);

    if (!emailValid || !passwordValid) {
      return;
    }

    setLoading(true);

    setTimeout(() => {
      const success = login(email.trim(), password);
      if (success) {
        const found = JSON.parse(localStorage.getItem("osm_user") || "null");
        const redirect = found ? (roleRedirects[found.role] || "/login") : "/login";
        navigate(redirect);
      } else {
        setError("Invalid email or password. Please try again.");
      }
      setLoading(false);
    }, 600);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gray-900 flex items-center justify-center mx-auto mb-4">
            <i className="ri-check-double-line text-white text-2xl"></i>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">OSM Pro</h1>
          <p className="text-sm text-gray-500 mt-1">Onscreen Marking System</p>
        </div>

        <div className="bg-white rounded-2xl p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Welcome back</h2>

          {error && (
            <div className="mb-5 flex items-center gap-2.5 text-sm text-rose-600 bg-rose-50 rounded-lg px-4 py-3">
              <span className="w-4 h-4 flex items-center justify-center shrink-0">
                <i className="ri-error-warning-line"></i>
              </span>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (fieldErrors.email) validateEmail(e.target.value); }}
                onBlur={() => validateEmail(email)}
                placeholder="Enter your email"
                className={`w-full px-4 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-shadow duration-150 placeholder:text-gray-400 ${fieldErrors.email ? "border-rose-400" : "border-gray-200"}`}
                autoComplete="email"
              />
              {fieldErrors.email && (
                <p className="text-xs text-rose-500 mt-1">{fieldErrors.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); if (fieldErrors.password) validatePassword(e.target.value); }}
                  onBlur={() => validatePassword(password)}
                  placeholder="Enter your password"
                  className={`w-full px-4 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-shadow duration-150 pr-11 placeholder:text-gray-400 ${fieldErrors.password ? "border-rose-400" : "border-gray-200"}`}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <i className={`${showPassword ? "ri-eye-off-line" : "ri-eye-line"} text-base`}></i>
                </button>
              </div>
              {fieldErrors.password && (
                <p className="text-xs text-rose-500 mt-1">{fieldErrors.password}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 flex items-center justify-center">
                    <i className="ri-loader-4-line animate-spin text-sm"></i>
                  </span>
                  Signing in...
                </span>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-gray-100">
            <p className="text-xs text-gray-400 text-center">
              Demo credentials — use any of the mock accounts to sign in
            </p>
            <div className="mt-3 grid grid-cols-1 gap-1.5">
              <button onClick={() => { setEmail("admin@osm.com"); setPassword("admin123"); setFieldErrors({}); }} className="text-xs text-gray-500 hover:text-gray-900 transition-colors cursor-pointer text-left px-3 py-1.5 rounded-md hover:bg-gray-50 whitespace-nowrap">
                <span className="font-medium">Admin:</span> admin@osm.com / admin123
              </button>
              <button onClick={() => { setEmail("sharma@osm.com"); setPassword("pass123"); setFieldErrors({}); }} className="text-xs text-gray-500 hover:text-gray-900 transition-colors cursor-pointer text-left px-3 py-1.5 rounded-md hover:bg-gray-50 whitespace-nowrap">
                <span className="font-medium">Teacher+Checker:</span> sharma@osm.com / pass123
              </button>
              <button onClick={() => { setEmail("priya@osm.com"); setPassword("pass123"); setFieldErrors({}); }} className="text-xs text-gray-500 hover:text-gray-900 transition-colors cursor-pointer text-left px-3 py-1.5 rounded-md hover:bg-gray-50 whitespace-nowrap">
                <span className="font-medium">Checker:</span> priya@osm.com / pass123
              </button>
              <button onClick={() => { setEmail("ravi@osm.com"); setPassword("pass123"); setFieldErrors({}); }} className="text-xs text-gray-500 hover:text-gray-900 transition-colors cursor-pointer text-left px-3 py-1.5 rounded-md hover:bg-gray-50 whitespace-nowrap">
                <span className="font-medium">Rechecking:</span> ravi@osm.com / pass123
              </button>
              <button onClick={() => { setEmail("neha@osm.com"); setPassword("pass123"); setFieldErrors({}); }} className="text-xs text-gray-500 hover:text-gray-900 transition-colors cursor-pointer text-left px-3 py-1.5 rounded-md hover:bg-gray-50 whitespace-nowrap">
                <span className="font-medium">Teacher:</span> neha@osm.com / pass123
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}