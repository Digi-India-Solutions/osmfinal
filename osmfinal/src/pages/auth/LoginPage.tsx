// // pages/auth/LoginPage.tsx

// import { useState, useEffect, useRef } from 'react';
// import { type FormEvent } from 'react';
// import { useAuth } from '@/context/AuthContext';
// import { useNavigate, useSearchParams } from 'react-router-dom';
// import { userApi } from '@/api/users';

// const roleRedirects: Record<string, string> = {
//   super_admin: '/super-admin', // ✅ ALAG ROUTE
//   admin: '/admin',
//   teacher: '/teacher',
//   checker: '/checker',
//   teacher_checker: '/teacher',
//   rechecking: '/recheck',
// };

// export default function LoginPage() {
//   const { login, currentUser, isAuthenticated, isLoading } = useAuth();
//   const navigate = useNavigate();
//   const [searchParams] = useSearchParams();

//   const [email, setEmail] = useState('');
//   const [password, setPassword] = useState('');
//   const [showPassword, setShowPassword] = useState(false);
//   const [error, setError] = useState('');
//   const [fieldErrors, setFieldErrors] = useState<{
//     email?: string;
//     password?: string;
//   }>({});
//   const [loggingIn, setLoggingIn] = useState(false);

//   // ✅ Use useRef to prevent multiple redirects
//   const hasRedirected = useRef(false);
//   const isRedirecting = useRef(false);

//   // ─── OTP STATE (separate from form) ─────────────────────────
//   const [otp, setOtp] = useState('');
//   const [otpSending, setOtpSending] = useState(false);
//   const [otpVerifying, setOtpVerifying] = useState(false);
//   const [otpSent, setOtpSent] = useState(false);
//   const [otpVerified, setOtpVerified] = useState(false); // ✅ track verified
//   const [otpError, setOtpError] = useState('');
//   const [otpResendTimer, setOtpResendTimer] = useState(0);

//   // ─── REFS ────────────────────────────────────────────────────
//   const originalEmailRef = useRef<string>('');
//   const otpInputRef = useRef<HTMLInputElement>(null);
//   const modalRef = useRef<HTMLDivElement>(null);
//   const deleteModalRef = useRef<HTMLDivElement>(null);

//   // ─── Check for unauthorized error ──────────────────────────────

//   useEffect(() => {
//     const errorParam = searchParams.get('error');
//     if (errorParam === 'unauthorized') {
//       setError(
//         "You don't have permission to access that page. Please login with correct credentials.",
//       );
//     }
//   }, [searchParams]);

//   // ─── Redirect if already authenticated ──────────────────────────

//   useEffect(() => {
//     // ✅ Prevent multiple redirects
//     if (
//       !isLoading &&
//       isAuthenticated &&
//       currentUser &&
//       !hasRedirected.current &&
//       !isRedirecting.current
//     ) {
//       console.log('🔍 Current User:', currentUser);
//       console.log('🔍 User Role:', currentUser.role);

//       const redirect = roleRedirects[currentUser.role] || '/login';
//       console.log('🔍 Redirecting to:', redirect);

//       // ✅ Mark as redirected
//       hasRedirected.current = true;
//       isRedirecting.current = true;

//       // ✅ Navigate
//       navigate(redirect, { replace: true });

//       // ✅ Reset redirecting flag after navigation
//       setTimeout(() => {
//         isRedirecting.current = false;
//       }, 500);
//     }
//   }, [isLoading, isAuthenticated, currentUser, navigate]);

//   // ✅ Reset redirected when user logs out
//   useEffect(() => {
//     if (!currentUser) {
//       hasRedirected.current = false;
//       isRedirecting.current = false;
//     }
//   }, [currentUser]);

//   // ─── Validations ──────────────────────────────────────────────────

//   const validateEmail = (value: string) => {
//     if (!value.trim()) {
//       setFieldErrors((prev) => ({
//         ...prev,
//         email: 'Email address is required',
//       }));
//       return false;
//     }
//     if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
//       setFieldErrors((prev) => ({
//         ...prev,
//         email: 'Please enter a valid email address',
//       }));
//       return false;
//     }
//     setFieldErrors((prev) => {
//       const next = { ...prev };
//       delete next.email;
//       return next;
//     });
//     return true;
//   };

//   const validatePassword = (value: string) => {
//     if (!value.trim()) {
//       setFieldErrors((prev) => ({ ...prev, password: 'Password is required' }));
//       return false;
//     }
//     setFieldErrors((prev) => {
//       const next = { ...prev };
//       delete next.password;
//       return next;
//     });
//     return true;
//   };

//   // ─── Submit ───────────────────────────────────────────────────────

//   const handleSubmit = async (e: FormEvent) => {
//     e.preventDefault();
//     setError('');

//     const emailValid = validateEmail(email);
//     const passwordValid = validatePassword(password);

//     if (!emailValid || !passwordValid) {
//       return;
//     }

//     setLoggingIn(true);

//     try {
//       const success = await login(email.trim(), password);

//       if (success) {
//         // ✅ Reset flag to allow redirect
//         hasRedirected.current = false;
//         isRedirecting.current = false;
//       } else {
//         setError('Invalid email or password. Please try again.');
//       }
//     } catch (error) {
//       setError('An error occurred. Please try again.');
//     } finally {
//       setLoggingIn(false);
//     }
//   };

//   const handleSendOtp = async () => {
//     if (!email.trim() || !validateField('email', email)) return;

//     setOtpSending(true);
//     setOtpError('');
//     setOtpVerified(false);
//     setOtp('');

//     try {
//       await userApi.sendOtp(email.trim());
//       setOtpSent(true);
//       setOtpResendTimer(60);
//       showToast(`OTP sent to ${email}`, 'success');
//       setTimeout(() => otpInputRef.current?.focus(), 100);
//     } catch (error: any) {
//       const msg = error.response?.data?.message || 'Failed to send OTP';
//       setOtpError(msg);
//       showToast(msg, 'error');
//     } finally {
//       setOtpSending(false);
//     }
//   };

//   // ─── OTP VERIFY ──────────────────────────────────────────────
//   const handleVerifyOtp = async () => {
//     if (!otp.trim() || otp.length < 4) {
//       setOtpError('Please enter a valid OTP');
//       return;
//     }
//     setOtpVerifying(true);
//     setOtpError('');
//     try {
//       await userApi.verifyOtp(email.trim(), otp.trim());
//       setOtpVerified(true);
//       showToast('Email verified successfully ✓', 'success');
//     } catch (error: any) {
//       const msg = error.response?.data?.message || 'Invalid OTP. Please try again.';
//       setOtpError(msg);
//     } finally {
//       setOtpVerifying(false);
//     }
//   };

//   // ─── Loading State ───────────────────────────────────────────────

//   if (isLoading) {
//     return (
//       <div className="min-h-screen flex items-center justify-center bg-gray-100">
//         <div className="text-center">
//           <div className="w-12 h-12 border-4 border-gray-900 border-t-transparent rounded-full animate-spin mx-auto"></div>
//           <p className="mt-4 text-gray-600">Loading...</p>
//         </div>
//       </div>
//     );
//   }

//   // ─── Render ───────────────────────────────────────────────────────

//   return (
//     <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
//       <div className="w-full max-w-md">
//         {/* Logo */}
//         <div className="text-center mb-8">
//           <div className="w-14 h-14 rounded-2xl bg-gray-900 flex items-center justify-center mx-auto mb-4">
//             <i className="ri-check-double-line text-white text-2xl"></i>
//           </div>
//           <h1 className="text-2xl font-bold text-gray-900">OSM Pro</h1>
//           <p className="text-sm text-gray-500 mt-1">Onscreen Marking System</p>
//         </div>

//         {/* Login Form */}
//         <div className="bg-white rounded-2xl p-8">
//           <h2 className="text-lg font-semibold text-gray-900 mb-6">
//             Welcome back
//           </h2>
//           {error && (
//             <div className="mb-5 flex items-center gap-2.5 text-sm text-rose-600 bg-rose-50 rounded-lg px-4 py-3">
//               <span className="w-4 h-4 flex items-center justify-center shrink-0">
//                 <i className="ri-error-warning-line"></i>
//               </span>
//               {error}
//             </div>
//           )}
//           <form onSubmit={handleSubmit} className="space-y-5">
//             <div>
//               <label
//                 htmlFor="email"
//                 className="block text-sm font-medium text-gray-700 mb-1.5"
//               >
//                 Email Address
//               </label>
//               <input
//                 id="email"
//                 type="email"
//                 value={email}
//                 onChange={(e) => {
//                   setEmail(e.target.value);
//                   if (fieldErrors.email) validateEmail(e.target.value);
//                 }}
//                 onBlur={() => validateEmail(email)}
//                 placeholder="Enter your email"
//                 className={`w-full px-4 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-shadow duration-150 placeholder:text-gray-400 ${fieldErrors.email ? 'border-rose-400' : 'border-gray-200'}`}
//                 autoComplete="email"
//               />
//               {fieldErrors.email && (
//                 <p className="text-xs text-rose-500 mt-1">
//                   {fieldErrors.email}
//                 </p>
//               )}
//             </div>
//             {email.length > 0 && <button onClick={handleSendOtp}>
//               Verify Email
//             </button>}
//             <div>
//               <label
//                 htmlFor="email"
//                 className="block text-sm font-medium text-gray-700 mb-1.5"
//               >
//                 OTP
//               </label>
//               <input
//                 id="otp"
//                 type="text"
//                 value={otp}
//                 onChange={(e) => {
//                   setOtp(e.target.value);
//                   if (fieldErrors.otp) validateEmail(e.target.value);
//                 }}
//                 onBlur={() => validateEmail(otp)}
//                 placeholder="Enter your otp"
//                 className={`w-full px-4 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-shadow duration-150 placeholder:text-gray-400 ${fieldErrors.otp ? 'border-rose-400' : 'border-gray-200'}`}
//                 autoComplete="otp"
//               />
//               {fieldErrors.otp && (
//                 <p className="text-xs text-rose-500 mt-1">
//                   {fieldErrors.otp}
//                 </p>
//               )}
//             </div>

//             <div>
//               <label
//                 htmlFor="password"
//                 className="block text-sm font-medium text-gray-700 mb-1.5"
//               >
//                 Password
//               </label>
//               <div className="relative">
//                 <input
//                   id="password"
//                   type={showPassword ? 'text' : 'password'}
//                   value={password}
//                   onChange={(e) => {
//                     setPassword(e.target.value);
//                     if (fieldErrors.password) validatePassword(e.target.value);
//                   }}
//                   onBlur={() => validatePassword(password)}
//                   placeholder="Enter your password"
//                   className={`w-full px-4 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-shadow duration-150 pr-11 placeholder:text-gray-400 ${fieldErrors.password ? 'border-rose-400' : 'border-gray-200'}`}
//                   autoComplete="current-password"
//                 />
//                 <button
//                   type="button"
//                   onClick={() => setShowPassword(!showPassword)}
//                   className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
//                   aria-label={showPassword ? 'Hide password' : 'Show password'}
//                 >
//                   <i
//                     className={`${showPassword ? 'ri-eye-off-line' : 'ri-eye-line'} text-base`}
//                   ></i>
//                 </button>
//               </div>
//               {fieldErrors.password && (
//                 <p className="text-xs text-rose-500 mt-1">
//                   {fieldErrors.password}
//                 </p>
//               )}
//             </div>

//             <button
//               type="submit"
//               disabled={loggingIn}
//               className="w-full py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
//             >
//               {loggingIn ? (
//                 <span className="flex items-center justify-center gap-2">
//                   <span className="w-4 h-4 flex items-center justify-center">
//                     <i className="ri-loader-4-line animate-spin text-sm"></i>
//                   </span>
//                   Signing in...
//                 </span>
//               ) : (
//                 'Sign In'
//               )}
//             </button>
//           </form>

//           {/* ─── DEMO CREDENTIALS ──────────────────────────────────── */}
//           <div className="mt-6 pt-5 border-t border-gray-100">
//             <p className="text-xs text-gray-400 text-center mb-3">
//               🚀 Demo Credentials — Click to auto-fill
//             </p>
//             <div className="grid grid-cols-1 gap-1.5">
//               {/* Super Admin */}
//               <button
//                 onClick={() => {
//                   setEmail('superadmin@osm.com');
//                   setPassword('Super@123');
//                   setFieldErrors({});
//                   setError('');
//                 }}
//                 className="text-xs text-gray-500 hover:text-gray-900 transition-colors cursor-pointer text-left px-3 py-1.5 rounded-md hover:bg-gray-50 whitespace-nowrap flex items-center justify-between"
//               >
//                 <span>
//                   <span className="font-medium text-gray-700">
//                     ⭐ Super Admin:
//                   </span>{' '}
//                   superadmin@osm.com
//                 </span>
//                 <span className="text-gray-400">Super@123</span>
//               </button>

//               {/* Admin */}
//               <button
//                 onClick={() => {
//                   setEmail('admin@osm.com');
//                   setPassword('admin123');
//                   setFieldErrors({});
//                   setError('');
//                 }}
//                 className="text-xs text-gray-500 hover:text-gray-900 transition-colors cursor-pointer text-left px-3 py-1.5 rounded-md hover:bg-gray-50 whitespace-nowrap flex items-center justify-between"
//               >
//                 <span>
//                   <span className="font-medium text-gray-700">👑 Admin:</span>{' '}
//                   admin@osm.com
//                 </span>
//                 <span className="text-gray-400">admin123</span>
//               </button>

//               {/* Teacher */}
//               <button
//                 onClick={() => {
//                   setEmail('teacher@exam.com');
//                   setPassword('admin123');
//                   setFieldErrors({});
//                   setError('');
//                 }}
//                 className="text-xs text-gray-500 hover:text-gray-900 transition-colors cursor-pointer text-left px-3 py-1.5 rounded-md hover:bg-gray-50 whitespace-nowrap flex items-center justify-between"
//               >
//                 <span>
//                   <span className="font-medium text-gray-700">👨‍🏫 Teacher:</span>{' '}
//                   teacher@exam.com
//                 </span>
//                 <span className="text-gray-400">admin123</span>
//               </button>

//               {/* Checker */}
//               <button
//                 onClick={() => {
//                   setEmail('checker@exam.com');
//                   setPassword('admin123');
//                   setFieldErrors({});
//                   setError('');
//                 }}
//                 className="text-xs text-gray-500 hover:text-gray-900 transition-colors cursor-pointer text-left px-3 py-1.5 rounded-md hover:bg-gray-50 whitespace-nowrap flex items-center justify-between"
//               >
//                 <span>
//                   <span className="font-medium text-gray-700">👨‍💻 Checker:</span>{' '}
//                   checker@exam.com
//                 </span>
//                 <span className="text-gray-400">admin123</span>
//               </button>

//               {/* Teacher + Checker */}
//               <button
//                 onClick={() => {
//                   setEmail('teacherchecker@exam.com');
//                   setPassword('admin123');
//                   setFieldErrors({});
//                   setError('');
//                 }}
//                 className="text-xs text-gray-500 hover:text-gray-900 transition-colors cursor-pointer text-left px-3 py-1.5 rounded-md hover:bg-gray-50 whitespace-nowrap flex items-center justify-between"
//               >
//                 <span>
//                   <span className="font-medium text-gray-700">
//                     👨‍🏫👨‍💻 T+Checker:
//                   </span>{' '}
//                   teacherchecker@exam.com
//                 </span>
//                 <span className="text-gray-400">admin123</span>
//               </button>

//               {/* Rechecking */}
//               <button
//                 onClick={() => {
//                   setEmail('recheck@exam.com');
//                   setPassword('admin123');
//                   setFieldErrors({});
//                   setError('');
//                 }}
//                 className="text-xs text-gray-500 hover:text-gray-900 transition-colors cursor-pointer text-left px-3 py-1.5 rounded-md hover:bg-gray-50 whitespace-nowrap flex items-center justify-between"
//               >
//                 <span>
//                   <span className="font-medium text-gray-700">
//                     🔄 Rechecking:
//                   </span>{' '}
//                   recheck@exam.com
//                 </span>
//                 <span className="text-gray-400">admin123</span>
//               </button>
//             </div>
//           </div>
//         </div>
//       </div>
//     </div >
//   );
// }



// pages/auth/LoginPage.tsx
// ✅ Flow: Step 1 → Email + Send OTP → Step 2 → Verify OTP → Step 3 → Password + Login
// ✅ UI unchanged — same card, same colors, same font sizes, same layout

import { useState, useEffect, useRef } from 'react';
import { type FormEvent } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { userApi } from '@/api/users';

const roleRedirects: Record<string, string> = {
  super_admin: '/super-admin',
  admin: '/admin',
  teacher: '/teacher',
  checker: '/checker',
  teacher_checker: '/teacher',
  rechecking: '/recheck',
};

// ─── 3 steps ────────────────────────────────────────────────────
// 'email'    → enter email + Send OTP button
// 'otp'      → enter OTP + Verify button
// 'password' → enter password + Sign In button
type Step = 'email' | 'otp' | 'password';

export default function LoginPage() {
  const { login, currentUser, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // ─── Form values ─────────────────────────────────────────────
  const [email, setEmail]       = useState('');
  const [otp, setOtp]           = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // ─── Step state ──────────────────────────────────────────────
  const [step, setStep] = useState<Step>('email');

  // ─── Loading / error ─────────────────────────────────────────
  const [otpSending, setOtpSending]   = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [loggingIn, setLoggingIn]     = useState(false);
  const [error, setError]             = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string; otp?: string; password?: string;
  }>({});

  // ─── Resend timer ────────────────────────────────────────────
  const [otpResendTimer, setOtpResendTimer] = useState(0);

  // ─── Redirect guards ─────────────────────────────────────────
  const hasRedirected  = useRef(false);
  const isRedirecting  = useRef(false);
  const otpInputRef    = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // ─── OTP countdown ───────────────────────────────────────────
  useEffect(() => {
    if (otpResendTimer <= 0) return;
    const t = setTimeout(() => setOtpResendTimer((p) => p - 1), 1000);
    return () => clearTimeout(t);
  }, [otpResendTimer]);

  // ─── Unauthorized query param ────────────────────────────────
  useEffect(() => {
    if (searchParams.get('error') === 'unauthorized') {
      setError("You don't have permission to access that page. Please login with correct credentials.");
    }
  }, [searchParams]);

  // ─── Redirect when authenticated ─────────────────────────────
  useEffect(() => {
    if (!isLoading && isAuthenticated && currentUser && !hasRedirected.current && !isRedirecting.current) {
      const redirect = roleRedirects[currentUser.role] || '/login';
      hasRedirected.current  = true;
      isRedirecting.current  = true;
      navigate(redirect, { replace: true });
      setTimeout(() => { isRedirecting.current = false; }, 500);
    }
  }, [isLoading, isAuthenticated, currentUser, navigate]);

  useEffect(() => {
    if (!currentUser) {
      hasRedirected.current = false;
      isRedirecting.current = false;
    }
  }, [currentUser]);

  // ─── Helpers ─────────────────────────────────────────────────
  const clearFieldError = (field: keyof typeof fieldErrors) =>
    setFieldErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });

  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  // ─── STEP 1: Send OTP ────────────────────────────────────────
  const handleSendOtp = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setFieldErrors({ email: 'Email address is required' });
      return;
    }
    if (!isValidEmail(email)) {
      setFieldErrors({ email: 'Please enter a valid email address' });
      return;
    }
    clearFieldError('email');

    setOtpSending(true);
    try {
      await userApi.sendOtp(email.trim());
      setOtpResendTimer(60);
      setStep('otp');
      setTimeout(() => otpInputRef.current?.focus(), 100);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to send OTP. Please try again.';
      setError(msg);
    } finally {
      setOtpSending(false);
    }
  };

  // ─── Resend OTP ──────────────────────────────────────────────
  const handleResendOtp = async () => {
    if (otpResendTimer > 0 || otpSending) return;
    setOtpSending(true);
    setOtp('');
    clearFieldError('otp');
    try {
      await userApi.sendOtp(email.trim());
      setOtpResendTimer(60);
      setTimeout(() => otpInputRef.current?.focus(), 100);
    } catch {
      setError('Failed to resend OTP. Please try again.');
    } finally {
      setOtpSending(false);
    }
  };

  // ─── STEP 2: Verify OTP ──────────────────────────────────────
  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!otp.trim() || otp.length < 4) {
      setFieldErrors({ otp: 'Please enter a valid OTP' });
      return;
    }
    clearFieldError('otp');

    setOtpVerifying(true);
    try {
      await userApi.verifyOtp(email.trim(), otp.trim());
      // ✅ OTP verified — move to password step
      setStep('password');
      setTimeout(() => passwordInputRef.current?.focus(), 100);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Invalid OTP. Please try again.';
      setFieldErrors({ otp: msg });
    } finally {
      setOtpVerifying(false);
    }
  };

  // ─── STEP 3: Login with password ─────────────────────────────
  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!password.trim()) {
      setFieldErrors({ password: 'Password is required' });
      return;
    }
    clearFieldError('password');

    setLoggingIn(true);
    try {
      const success = await login(email.trim(), password);
      if (success) {
        hasRedirected.current = false;
        isRedirecting.current = false;
      } else {
        setFieldErrors({ password: 'Incorrect password. Please try again.' });
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setLoggingIn(false);
    }
  };

  // ─── Demo auto-fill ──────────────────────────────────────────
  const fillDemo = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setOtp('');
    setStep('email');
    setError('');
    setFieldErrors({});
    setOtpResendTimer(0);
  };

  // ─── Step metadata ────────────────────────────────────────────
  const stepMeta = {
    email:    { heading: 'Welcome back',         sub: 'Enter your email to continue' },
    otp:      { heading: 'Verify your email',    sub: `OTP sent to ${email}` },
    password: { heading: 'Enter your password',  sub: email },
  };

  // ─── Loading screen ───────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gray-900 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-md">

        {/* ── Logo — unchanged ── */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gray-900 flex items-center justify-center mx-auto mb-4">
            <i className="ri-check-double-line text-white text-2xl"></i>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">OSM Pro</h1>
          <p className="text-sm text-gray-500 mt-1">Onscreen Marking System</p>
        </div>

        {/* ── Card — unchanged ── */}
        <div className="bg-white rounded-2xl p-8">

          {/* Step heading */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900">
              {stepMeta[step].heading}
            </h2>
            {step !== 'email' && (
              <p className="text-xs text-gray-400 mt-1 truncate">
                {stepMeta[step].sub}
              </p>
            )}
          </div>

          {/* Global error */}
          {error && (
            <div className="mb-5 flex items-center gap-2.5 text-sm text-rose-600 bg-rose-50 rounded-lg px-4 py-3">
              <span className="w-4 h-4 flex items-center justify-center shrink-0">
                <i className="ri-error-warning-line"></i>
              </span>
              {error}
            </div>
          )}

          {/* ─── STEP 1: Email ─── */}
          {step === 'email' && (
            <form onSubmit={handleSendOtp} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); clearFieldError('email'); }}
                  onBlur={() => {
                    if (!email.trim()) setFieldErrors((p) => ({ ...p, email: 'Email address is required' }));
                    else if (!isValidEmail(email)) setFieldErrors((p) => ({ ...p, email: 'Please enter a valid email address' }));
                  }}
                  placeholder="Enter your email"
                  className={`w-full px-4 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-shadow duration-150 placeholder:text-gray-400 ${fieldErrors.email ? 'border-rose-400' : 'border-gray-200'}`}
                  autoComplete="email"
                  autoFocus
                />
                {fieldErrors.email && (
                  <p className="text-xs text-rose-500 mt-1">{fieldErrors.email}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={otpSending}
                className="w-full py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
              >
                {otpSending ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 flex items-center justify-center">
                      <i className="ri-loader-4-line animate-spin text-sm"></i>
                    </span>
                    Sending OTP...
                  </span>
                ) : (
                  'Continue'
                )}
              </button>
            </form>
          )}

          {/* ─── STEP 2: OTP ─── */}
          {step === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div>
                <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Verification Code
                </label>
                <input
                  ref={otpInputRef}
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  value={otp}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setOtp(val);
                    clearFieldError('otp');
                  }}
                  placeholder="Enter 6-digit OTP"
                  maxLength={6}
                  className={`w-full px-4 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-shadow duration-150 placeholder:text-gray-400 tracking-widest text-center font-semibold ${fieldErrors.otp ? 'border-rose-400' : 'border-gray-200'}`}
                  autoComplete="one-time-code"
                />
                {fieldErrors.otp && (
                  <p className="text-xs text-rose-500 mt-1">{fieldErrors.otp}</p>
                )}
                <div className="flex items-center justify-between mt-1.5">
                  <p className="text-xs text-gray-400">Check your inbox</p>
                  {otpResendTimer > 0 ? (
                    <p className="text-xs text-gray-400">
                      Resend in <span className="font-medium text-gray-600">{otpResendTimer}s</span>
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={otpSending}
                      className="text-xs text-gray-600 hover:text-gray-900 font-medium transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {otpSending ? 'Sending...' : 'Resend OTP'}
                    </button>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={otpVerifying || otp.length < 4}
                className="w-full py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
              >
                {otpVerifying ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 flex items-center justify-center">
                      <i className="ri-loader-4-line animate-spin text-sm"></i>
                    </span>
                    Verifying...
                  </span>
                ) : (
                  'Verify & Continue'
                )}
              </button>

              <button
                type="button"
                onClick={() => { setStep('email'); setOtp(''); setError(''); setFieldErrors({}); }}
                className="w-full text-xs text-gray-400 hover:text-gray-600 transition-colors cursor-pointer text-center"
              >
                ← Back
              </button>
            </form>
          )}

          {/* ─── STEP 3: Password ─── */}
          {step === 'password' && (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    ref={passwordInputRef}
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); clearFieldError('password'); }}
                    onBlur={() => { if (!password.trim()) setFieldErrors((p) => ({ ...p, password: 'Password is required' })); }}
                    placeholder="Enter your password"
                    className={`w-full px-4 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-shadow duration-150 pr-11 placeholder:text-gray-400 ${fieldErrors.password ? 'border-rose-400' : 'border-gray-200'}`}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <i className={`${showPassword ? 'ri-eye-off-line' : 'ri-eye-line'} text-base`}></i>
                  </button>
                </div>
                {fieldErrors.password && (
                  <p className="text-xs text-rose-500 mt-1">{fieldErrors.password}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loggingIn}
                className="w-full py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
              >
                {loggingIn ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 flex items-center justify-center">
                      <i className="ri-loader-4-line animate-spin text-sm"></i>
                    </span>
                    Signing in...
                  </span>
                ) : (
                  'Sign In'
                )}
              </button>

              <button
                type="button"
                onClick={() => { setStep('otp'); setPassword(''); setError(''); setFieldErrors({}); }}
                className="w-full text-xs text-gray-400 hover:text-gray-600 transition-colors cursor-pointer text-center"
              >
                ← Back
              </button>
            </form>
          )}

          {/* ─── Demo credentials — only on step 1 ─── */}
          {step === 'email' && (
            <div className="mt-6 pt-5 border-t border-gray-100">
              <p className="text-xs text-gray-400 text-center mb-3">
                🚀 Demo Credentials — Click to auto-fill
              </p>
              <div className="grid grid-cols-1 gap-1.5">
                {[
                  { icon: '⭐', label: 'Super Admin', email: 'superadmin@osm.com', pass: 'Super@123' },
                  { icon: '👑', label: 'Admin',       email: 'admin@osm.com',       pass: 'admin123' },
                  { icon: '👨‍🏫', label: 'Teacher',   email: 'teacher@exam.com',    pass: 'admin123' },
                  { icon: '👨‍💻', label: 'Checker',   email: 'checker@exam.com',    pass: 'admin123' },
                  { icon: '👨‍🏫👨‍💻', label: 'T+Checker', email: 'teacherchecker@exam.com', pass: 'admin123' },
                  { icon: '🔄', label: 'Rechecking',  email: 'recheck@exam.com',    pass: 'admin123' },
                ].map(({ icon, label, email: dEmail, pass }) => (
                  <button
                    key={dEmail}
                    onClick={() => fillDemo(dEmail, pass)}
                    className="text-xs text-gray-500 hover:text-gray-900 transition-colors cursor-pointer text-left px-3 py-1.5 rounded-md hover:bg-gray-50 whitespace-nowrap flex items-center justify-between"
                  >
                    <span>
                      <span className="font-medium text-gray-700">{icon} {label}:</span>{' '}
                      {dEmail}
                    </span>
                    <span className="text-gray-400">{pass}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}