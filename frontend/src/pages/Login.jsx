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
  const [step, setStep] = useState('mobile');
  const [mobile, setMobile] = useState('');
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [devOtpHint, setDevOtpHint] = useState('');
  const [resendIn, setResendIn] = useState(0);
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

  const handleMobileSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (mobile.length !== 10) {
      setError('Enter a valid 10-digit mobile number.');
      return;
    }
    setLoading(true);
    try {
      const res = await sendOtp(mobile);
      setDevOtpHint(res.dev_otp || '');
      setStep('otp');
      setResendIn(30);
      setTimeout(() => otpRefs.current[0]?.focus(), 50);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
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
    const otpString = digits.join('');
    if (step === 'otp' && otpString.length === 6 && !loading) {
      submitOtp(otpString);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digits, step]);

  const handleResend = async () => {
    if (resendIn > 0) return;
    setError('');
    setLoading(true);
    try {
      const res = await sendOtp(mobile);
      setDevOtpHint(res.dev_otp || '');
      setResendIn(30);
      setDigits(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full flex items-center justify-center px-4 py-10 bg-gradient-to-br from-savo-mist via-white to-savo-purple-50">
      <div className="w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <Logo size="lg" />
          <p className="mt-4 text-savo-ink/60 text-sm">Your loyalty companion for every shop.</p>
        </div>

        <div className="savo-card p-6 sm:p-8">
          {step === 'mobile' ? (
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

              {isDev && (
                <div className="text-xs text-savo-ink/50 text-center mt-1">
                  Dev mode · OTP is printed to backend console &amp; returned in response.
                </div>
              )}

              <div className="border-t border-savo-purple-100/50 pt-4 mt-2">
                <p className="text-xs text-savo-ink/50 text-center mb-2">Demo accounts</p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {[
                    { num: '9999999999', tier: 'Gold' },
                    { num: '8888888888', tier: 'Silver' },
                    { num: '7777777777', tier: 'Bronze' },
                  ].map((d) => (
                    <button
                      type="button"
                      key={d.num}
                      onClick={() => setMobile(d.num)}
                      className="rounded-lg border border-savo-purple-100 hover:border-savo-purple hover:bg-savo-purple-50 py-2 text-savo-purple font-semibold transition"
                    >
                      {d.tier}
                    </button>
                  ))}
                </div>
              </div>
            </form>
          ) : (
            <div className="space-y-5">
              <div>
                <button
                  onClick={() => {
                    setStep('mobile');
                    setError('');
                    setDigits(['', '', '', '', '', '']);
                  }}
                  className="text-xs text-savo-purple font-semibold hover:underline mb-3"
                >
                  ← Change number
                </button>
                <h1 className="text-2xl font-bold text-savo-ink">Enter OTP</h1>
                <p className="text-sm text-savo-ink/60 mt-1">
                  Sent to +91 {mobile.slice(0, 5)} {mobile.slice(5)}
                </p>
              </div>

              <div
                className="grid grid-cols-6 gap-2 sm:gap-3"
                onPaste={handleOtpPaste}
              >
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => (otpRefs.current[i] = el)}
                    type="text"
                    inputMode="numeric"
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

              {isDev && devOtpHint && (
                <div className="text-xs text-savo-purple bg-savo-yellow-soft/60 border border-savo-yellow/60 rounded-lg px-3 py-2 text-center">
                  Dev OTP: <span className="font-mono font-bold">{devOtpHint}</span>
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
      </div>
    </div>
  );
}
