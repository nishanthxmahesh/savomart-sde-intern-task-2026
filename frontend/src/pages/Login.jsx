import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { verifyFirebaseToken } from '../api/auth';
import { apiErrorMessage } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { auth, isFirebaseReady, firebaseMissingVars } from '../firebase';
import Logo from '../components/Logo';

const isDev = import.meta.env.DEV;

// Map Firebase auth/* error codes to user-friendly copy
function firebaseErrorMessage(err) {
  const code = err?.code || '';
  if (code === 'auth/invalid-verification-code') return 'Wrong OTP. Please check the code and try again.';
  if (code === 'auth/code-expired') return 'This OTP has expired. Tap Resend OTP to get a new one.';
  if (code === 'auth/too-many-requests') return "You've tried too many times. Please wait a few minutes and try again.";
  if (code === 'auth/invalid-phone-number') return 'That mobile number looks invalid.';
  if (code === 'auth/quota-exceeded') return 'OTPs are temporarily unavailable. Please try again later.';
  if (code === 'auth/captcha-check-failed') return "We couldn't verify you're not a bot. Refresh the page and try again.";
  if (code === 'auth/network-request-failed') return 'Network issue while contacting Firebase. Check your connection.';
  return err?.message || 'Something went wrong while verifying. Please try again.';
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated } = useAuth();

  const [step, setStep] = useState('mobile'); // 'mobile' | 'otp' | 'not_enrolled'
  const [mobile, setMobile] = useState('');
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const [notEnrolledMsg, setNotEnrolledMsg] = useState('');
  const otpRefs = useRef([]);
  const confirmationRef = useRef(null);
  const recaptchaRef = useRef(null);

  const firebaseReady = isFirebaseReady();
  const missingVars = firebaseMissingVars();

  useEffect(() => {
    if (isAuthenticated) {
      const target = location.state?.from?.pathname || '/';
      navigate(target, { replace: true });
    }
  }, [isAuthenticated, navigate, location.state]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  // Clean up the reCAPTCHA on unmount so it doesn't persist across navigations
  useEffect(() => {
    return () => {
      try { recaptchaRef.current?.clear?.(); } catch { /* noop */ }
    };
  }, []);

  const ensureRecaptcha = () => {
    if (recaptchaRef.current) return recaptchaRef.current;
    // RecaptchaVerifier signature changed across firebase versions;
    // v10+ takes (auth, containerId, params).
    recaptchaRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', {
      size: 'invisible',
      callback: () => { /* solved — proceed */ },
      'expired-callback': () => {
        setError('Verification expired. Please tap Send OTP again.');
      },
    });
    return recaptchaRef.current;
  };

  const sendOtp = async () => {
    setError('');
    if (!firebaseReady) {
      setError(`Firebase is not configured. Missing env vars: ${missingVars.join(', ')}`);
      return;
    }
    if (mobile.length !== 10) {
      setError('Enter a valid 10-digit mobile number.');
      return;
    }
    setLoading(true);
    try {
      const verifier = ensureRecaptcha();
      const confirmation = await signInWithPhoneNumber(auth, `+91${mobile}`, verifier);
      confirmationRef.current = confirmation;
      setStep('otp');
      setResendIn(30);
      setDigits(['', '', '', '', '', '']);
      setTimeout(() => otpRefs.current[0]?.focus(), 50);
    } catch (err) {
      // Reset the reCAPTCHA on failure so the next attempt can re-render it
      try { recaptchaRef.current?.clear?.(); } catch { /* noop */ }
      recaptchaRef.current = null;
      setError(firebaseErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleMobileSubmit = (e) => {
    e.preventDefault();
    sendOtp();
  };

  const handleOtpChange = (idx, value) => {
    const v = value.replace(/\D/g, '').slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[idx] = v;
      return next;
    });
    if (v && idx < 5) otpRefs.current[idx + 1]?.focus();
  };

  const handleOtpKeyDown = (idx, e) => {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    } else if (e.key === 'ArrowRight' && idx < 5) {
      otpRefs.current[idx + 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    const text = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
    if (!text) return;
    e.preventDefault();
    const next = ['', '', '', '', '', ''];
    for (let i = 0; i < text.length; i++) next[i] = text[i];
    setDigits(next);
    otpRefs.current[Math.min(text.length, 5)]?.focus();
    if (text.length === 6) submitOtp(text);
  };

  const submitOtp = async (otpString) => {
    setLoading(true);
    setError('');
    try {
      if (!confirmationRef.current) {
        throw new Error('Verification session expired. Please request a new OTP.');
      }
      // 1. Confirm OTP with Firebase
      const credential = await confirmationRef.current.confirm(otpString);
      const firebaseToken = await credential.user.getIdToken();

      // 2. Exchange the Firebase token for our application JWT
      try {
        const res = await verifyFirebaseToken(firebaseToken, mobile);
        login(res.access_token, res.customer);
        const target = location.state?.from?.pathname || '/';
        navigate(target, { replace: true });
      } catch (backendErr) {
        if (backendErr?.response?.status === 403) {
          const data = backendErr.response.data || {};
          if (data.enrolled === false) {
            setNotEnrolledMsg(data.message || 'This mobile is not registered with Savomart.');
            setStep('not_enrolled');
            return;
          }
          setError(data.message || data.detail || 'This account cannot sign in.');
          return;
        }
        setError(apiErrorMessage(backendErr));
      }
    } catch (err) {
      setError(firebaseErrorMessage(err));
      setDigits(['', '', '', '', '', '']);
      setTimeout(() => otpRefs.current[0]?.focus(), 50);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const s = digits.join('');
    if (step === 'otp' && s.length === 6 && !loading) submitOtp(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digits, step]);

  const handleResend = async () => {
    if (resendIn > 0 || loading) return;
    // Reset the reCAPTCHA so a fresh one can be solved
    try { recaptchaRef.current?.clear?.(); } catch { /* noop */ }
    recaptchaRef.current = null;
    await sendOtp();
  };

  const backToMobile = () => {
    setStep('mobile');
    setError('');
    setDigits(['', '', '', '', '', '']);
    setNotEnrolledMsg('');
    confirmationRef.current = null;
  };

  return (
    <div className="min-h-full flex items-center justify-center px-4 py-10 bg-gradient-to-br from-savo-mist via-white to-savo-purple-50">
      <div className="w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <Logo size="lg" />
          <p className="mt-4 text-savo-ink/60 text-sm">Your loyalty companion for every shop.</p>
        </div>

        {!firebaseReady && (
          <div className="savo-card p-4 mb-4 border-amber-200 bg-amber-50/60">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-800 mb-1">
              Customer login not configured
            </p>
            <p className="text-xs text-amber-900/80 leading-relaxed">
              Firebase env vars are missing: <span className="font-mono">{missingVars.join(', ')}</span>.
              See <code>DEPLOY.md</code> for setup. Admin login at{' '}
              <a href="/admin/login" className="font-semibold underline">/admin/login</a> still works.
            </p>
          </div>
        )}

        <div className="savo-card p-6 sm:p-8">
          {step === 'mobile' && (
            <form onSubmit={handleMobileSubmit} className="space-y-5">
              <div>
                <h1 className="text-2xl font-bold text-savo-ink">Welcome back</h1>
                <p className="text-sm text-savo-ink/60 mt-1">
                  Enter your registered mobile number to continue.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-savo-ink/70 mb-2 uppercase tracking-wide">
                  Mobile number
                </label>
                <div className="flex items-stretch rounded-xl border border-savo-purple-100 overflow-hidden focus-within:ring-2 focus-within:ring-savo-purple/40 focus-within:border-savo-purple transition">
                  <span className="px-3 flex items-center bg-savo-purple-50 text-savo-purple font-semibold text-sm border-r border-savo-purple-100">
                    +91
                  </span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoFocus
                    autoComplete="tel-national"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="98765 43210"
                    className="flex-1 px-3 py-3 text-savo-ink placeholder:text-savo-ink/30 focus:outline-none text-base tracking-wide"
                  />
                </div>
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || mobile.length !== 10 || !firebaseReady}
                className="savo-btn-primary w-full text-base"
              >
                {loading ? (
                  <span className="inline-block w-5 h-5 border-2 border-savo-yellow/60 border-t-savo-yellow rounded-full animate-spin" />
                ) : (
                  'Send OTP'
                )}
              </button>

              <p className="text-[11px] text-savo-ink/50 text-center">
                We'll send a one-time code to your phone via Firebase.
              </p>
            </form>
          )}

          {step === 'otp' && (
            <div className="space-y-5">
              <div>
                <button
                  onClick={backToMobile}
                  className="text-xs text-savo-purple font-semibold hover:underline mb-3"
                >
                  ← Change number
                </button>
                <h1 className="text-2xl font-bold text-savo-ink">Enter OTP</h1>
                <p className="text-sm text-savo-ink/60 mt-1">
                  Sent to +91 {mobile.slice(0, 5)} {mobile.slice(5)}
                </p>
              </div>

              <div className="grid grid-cols-6 gap-2 sm:gap-3" onPaste={handleOtpPaste}>
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => (otpRefs.current[i] = el)}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={1}
                    value={d}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    className="savo-otp-cell"
                    disabled={loading}
                  />
                ))}
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-between text-sm">
                <span className="text-savo-ink/50">
                  {loading ? 'Verifying…' : 'Auto-submits when complete'}
                </span>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendIn > 0 || loading}
                  className="text-savo-purple font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend OTP'}
                </button>
              </div>
            </div>
          )}

          {step === 'not_enrolled' && (
            <div className="text-center space-y-4">
              <div className="mx-auto w-14 h-14 rounded-full bg-savo-yellow-soft grid place-items-center">
                <span className="text-3xl" aria-hidden>👋</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-savo-ink">Not registered yet</h1>
                <p className="text-sm text-savo-ink/65 mt-2 leading-relaxed">
                  {notEnrolledMsg}
                </p>
                <p className="text-xs text-savo-ink/45 mt-3">
                  +91 {mobile.slice(0, 5)} {mobile.slice(5)} isn't on file with us.
                </p>
              </div>
              <div className="rounded-xl bg-savo-purple-50 border border-savo-purple-100 p-3 text-left">
                <p className="text-xs font-bold uppercase tracking-wide text-savo-purple mb-1">How to enroll</p>
                <p className="text-xs text-savo-ink/70 leading-relaxed">
                  Drop by any Savomart store. The cashier will set up your loyalty account in under a minute — and you'll get a welcome bonus.
                </p>
              </div>
              <button onClick={backToMobile} className="savo-btn-secondary w-full text-sm">
                Try a different number
              </button>
            </div>
          )}
        </div>

        {/* Invisible reCAPTCHA — Firebase mounts the widget here */}
        <div id="recaptcha-container" />

        <p className="text-center text-xs text-savo-ink/40 mt-6">
          © 2026 SAVOmart · An entity of Ebono Private Limited
        </p>
        {isDev && (
          <p className="text-center text-[10px] text-savo-ink/35 mt-1">
            Admin? <a href="/admin/login" className="text-savo-purple font-semibold hover:underline">Sign in here</a>
          </p>
        )}
      </div>
    </div>
  );
}
