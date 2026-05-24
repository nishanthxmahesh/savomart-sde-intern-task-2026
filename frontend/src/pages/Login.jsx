import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { sendOtp, verifyOtp } from '../api/auth';
import { apiErrorMessage } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import Logo from '../components/Logo';

const isDev = import.meta.env.DEV;

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
  const [devOtp, setDevOtp] = useState('');
  const [notEnrolledMsg, setNotEnrolledMsg] = useState('');
  const otpRefs = useRef([]);

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

  const requestOtp = async () => {
    setError('');
    if (mobile.length !== 10) {
      setError('Enter a valid 10-digit mobile number.');
      return;
    }
    setLoading(true);
    try {
      const res = await sendOtp(mobile);
      setDevOtp(res.dev_otp || '');
      setStep('otp');
      setResendIn(30);
      setDigits(['', '', '', '', '', '']);
      setTimeout(() => otpRefs.current[0]?.focus(), 50);
    } catch (err) {
      // 403 with {enrolled: false, message} → not registered
      const detail = err?.response?.data?.detail;
      if (err?.response?.status === 403 && typeof detail === 'object') {
        if (detail.enrolled === false) {
          setNotEnrolledMsg(
            detail.message ||
            "This mobile isn't registered with Savomart. Please register at any Savomart store to access loyalty.",
          );
          setStep('not_enrolled');
          return;
        }
        setError(detail.message || 'This account cannot sign in.');
        return;
      }
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleMobileSubmit = (e) => {
    e.preventDefault();
    requestOtp();
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
      const res = await verifyOtp(mobile, otpString);
      login(res.access_token, res.user);
      const target = location.state?.from?.pathname || '/';
      navigate(target, { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err));
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
    await requestOtp();
  };

  const backToMobile = () => {
    setStep('mobile');
    setError('');
    setDigits(['', '', '', '', '', '']);
    setDevOtp('');
    setNotEnrolledMsg('');
  };

  const autofillOtp = () => {
    if (!devOtp) return;
    const next = devOtp.split('').slice(0, 6);
    while (next.length < 6) next.push('');
    setDigits(next);
  };

  const useDemoMobile = (m) => {
    setMobile(m);
    setError('');
    setTimeout(() => requestOtpForMobile(m), 0);
  };

  const requestOtpForMobile = async (m) => {
    setError('');
    setLoading(true);
    try {
      const res = await sendOtp(m);
      setDevOtp(res.dev_otp || '');
      setStep('otp');
      setResendIn(30);
      setDigits(['', '', '', '', '', '']);
      setTimeout(() => otpRefs.current[0]?.focus(), 50);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      if (err?.response?.status === 403 && typeof detail === 'object') {
        if (detail.enrolled === false) {
          setNotEnrolledMsg(detail.message || "This mobile isn't registered with Savomart.");
          setStep('not_enrolled');
          return;
        }
        setError(detail.message || 'This account cannot sign in.');
        return;
      }
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const DEMO_MOBILES = [
    { mobile: '9999999999', name: 'Aanya', tier: 'Gold' },
    { mobile: '8888888888', name: 'Rahul', tier: 'Silver' },
    { mobile: '7777777777', name: 'Priya', tier: 'Bronze' },
  ];

  return (
    <div className="min-h-full flex items-center justify-center px-4 py-10 bg-gradient-to-br from-savo-mist via-white to-savo-purple-50">
      <div className="w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <Logo size="lg" />
          <p className="mt-4 text-savo-ink/60 text-sm">Your loyalty companion for every shop.</p>
        </div>

        <div className="savo-card p-6 sm:p-8">
          {step === 'mobile' && (
            <form onSubmit={handleMobileSubmit} className="space-y-5">
              <div>
                <h1 className="text-2xl font-bold text-savo-ink">Welcome back</h1>
                <p className="text-sm text-savo-ink/60 mt-1">
                  Enter your mobile number to continue.
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
                disabled={loading || mobile.length !== 10}
                className="savo-btn-primary w-full text-base"
              >
                {loading ? (
                  <span className="inline-block w-5 h-5 border-2 border-savo-yellow/60 border-t-savo-yellow rounded-full animate-spin" />
                ) : (
                  'Send OTP'
                )}
              </button>

              <p className="text-[11px] text-savo-ink/50 text-center">
                We'll generate a one-time code for this session.
              </p>
            </form>
          )}

          {step === 'mobile' && (
            <>
              <div className="my-5 flex items-center gap-3 text-[10px] uppercase tracking-widest text-savo-ink/40 font-semibold">
                <span className="flex-1 h-px bg-savo-ink/10" />
                Try a demo account
                <span className="flex-1 h-px bg-savo-ink/10" />
              </div>

              <div className="space-y-2">
                {DEMO_MOBILES.map((d) => (
                  <button
                    key={d.mobile}
                    type="button"
                    onClick={() => useDemoMobile(d.mobile)}
                    disabled={loading}
                    className="w-full flex items-center justify-between gap-2 rounded-xl border border-savo-purple-100 bg-white hover:bg-savo-purple-50 active:bg-savo-purple-50 px-3 py-2.5 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap ${
                        d.tier === 'Gold' ? 'bg-savo-yellow-soft text-amber-900' :
                        d.tier === 'Silver' ? 'bg-slate-100 text-slate-700' :
                        'bg-amber-100 text-amber-900'
                      }`}>{d.tier}</span>
                      <span className="text-sm font-semibold text-savo-ink truncate">{d.name}</span>
                    </div>
                    <span className="font-mono text-xs text-savo-ink/70 whitespace-nowrap">
                      +91 {d.mobile.slice(0, 5)} {d.mobile.slice(5)}
                    </span>
                  </button>
                ))}
              </div>

              <div className="mt-5 rounded-xl bg-savo-purple-50 border border-savo-purple-100 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-savo-purple mb-1">
                  Want your mobile registered?
                </p>
                <p className="text-xs text-savo-ink/70 leading-relaxed">
                  Self-signup is disabled. Sign in as <strong>admin</strong> and enroll your number from <strong>Customers → Enroll customer</strong>, then come back here to log in.
                </p>
              </div>
            </>
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
                <p className="text-xs font-bold uppercase tracking-wide text-savo-purple mb-1">How to register</p>
                <p className="text-xs text-savo-ink/70 leading-relaxed">
                  Drop by any Savomart store. The cashier will set up your loyalty account in under a minute — and you'll get a welcome bonus.
                </p>
              </div>
              <button onClick={backToMobile} className="savo-btn-secondary w-full text-sm">
                Try a different number
              </button>
            </div>
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

              {devOtp && (
                <div className="rounded-xl bg-savo-yellow-soft border border-amber-200 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-amber-800 mb-1">
                    Demo OTP (no real SMS — Firebase Blaze upgrade coming later)
                  </p>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-2xl font-mono font-bold tracking-[0.4em] text-savo-ink">
                      {devOtp}
                    </span>
                    <button
                      type="button"
                      onClick={autofillOtp}
                      className="text-xs font-semibold text-savo-purple hover:underline whitespace-nowrap"
                    >
                      Auto-fill
                    </button>
                  </div>
                </div>
              )}

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
        </div>

        <p className="text-center text-xs text-savo-ink/40 mt-6">
          © 2026 SAVOmart · An entity of Ebono Private Limited
        </p>
        <p className="text-center text-sm text-savo-ink/60 mt-3">
          Admin?{' '}
          <a href="/admin/login" className="text-savo-purple font-bold hover:underline">
            Sign in here
          </a>
        </p>
      </div>
    </div>
  );
}
