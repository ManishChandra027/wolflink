import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, getApiMessage } from '../../lib/api.js';
import { Brand } from '../../components/Brand.jsx';
import { FeedbackMessage } from '../../components/common/FeedbackMessage.jsx';
import { toast } from 'sonner';

export function PasswordRecoveryPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState('request');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (step === 'request') {
        const response = await api.post('/auth/password-reset/request', { email });
        setMessage(response.data.data.message);
        toast.success('If your account exists, a reset code is on its way');
        setStep('verify');
      } else if (step === 'verify') {
        const response = await api.post('/auth/password-reset/verify', { email, otp });
        setResetToken(response.data.data.resetToken);
        setMessage(response.data.data.message);
        toast.success('Reset code accepted');
        setStep('reset');
      } else {
        if (password !== confirmPassword) throw new Error('Passwords do not match.');
        const response = await api.post('/auth/password-reset/confirm', { email, resetToken, password });
        setMessage(response.data.data.message);
        toast.success('Password updated. Sign in with your new password.');
        navigate('/login', { replace: true, state: { recoveryComplete: true } });
      }
    } catch (reason) {
      setError(reason.message === 'Passwords do not match.' ? reason.message : getApiMessage(reason));
      toast.error(reason.message === 'Passwords do not match.' ? reason.message : getApiMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function resendResetCode() {
    setResending(true);
    setError('');
    setMessage('');
    try {
      const response = await api.post('/auth/password-reset/request', { email });
      setMessage(`${response.data.data.message} Check spam if you do not see it; you can request another code after about a minute.`);
      toast.success('Reset code request submitted');
    } catch (reason) {
      setError(getApiMessage(reason));
      toast.error(getApiMessage(reason));
    } finally {
      setResending(false);
    }
  }

  return <main className="grid min-h-screen place-items-center bg-[#F3F4F2] px-5 py-10">
    <section className="w-full max-w-md rounded-2xl border border-[#E5E7EB] bg-white p-7 shadow-sm sm:p-10">
      <Brand />
      <p className="mt-10 text-xs font-semibold uppercase tracking-[0.18em] text-[#1B4332]">Account recovery</p>
      <h1 className="mt-3 font-serif text-3xl text-[#0F2D1F]">{step === 'request' ? 'Reset your password' : step === 'verify' ? 'Check your inbox' : 'Choose a new password'}</h1>
      <p className="mt-3 text-sm leading-6 text-[#68726E]">{step === 'request' ? 'We’ll send a six-digit reset code if an account matches.' : step === 'verify' ? 'Enter the six-digit reset code. It expires in 10 minutes.' : 'Set a new password to finish recovering your account.'}</p>
      <form className="mt-7 space-y-5" onSubmit={submit}>
        {(step === 'request' || step === 'verify' || step === 'reset') && <label className="block text-sm font-medium text-[#1F1F1F]">Email address<input className="auth-input mt-2" type="email" autoComplete="email" required maxLength={254} disabled={step !== 'request'} value={email} onChange={(event) => setEmail(event.target.value)} /></label>}
        {step === 'verify' && <label className="block text-sm font-medium text-[#1F1F1F]">Reset code<input className="auth-input mt-2 text-center font-mono text-lg tracking-[0.45em]" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} /></label>}
        {step === 'reset' && <><label className="block text-sm font-medium text-[#1F1F1F]">New password<input className="auth-input mt-2" type="password" autoComplete="new-password" minLength={8} maxLength={72} required value={password} onChange={(event) => setPassword(event.target.value)} /></label><label className="block text-sm font-medium text-[#1F1F1F]">Confirm password<input className="auth-input mt-2" type="password" autoComplete="new-password" minLength={8} maxLength={72} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label></>}
        <FeedbackMessage>{error}</FeedbackMessage>
        <FeedbackMessage kind="success">{message}</FeedbackMessage>
        <button className="w-full rounded-lg bg-[#1B4332] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0F2D1F] disabled:opacity-60" disabled={busy || (step === 'verify' && otp.length !== 6)} type="submit">{busy ? 'Please wait…' : step === 'request' ? 'Send reset code' : step === 'verify' ? 'Verify code' : 'Reset password'}</button>
        {step === 'verify' && <button className="w-full rounded-lg border border-[#1B4332]/20 px-4 py-2.5 text-sm font-medium text-[#1B4332] hover:bg-[#E8EFE9] disabled:opacity-60" disabled={busy || resending} onClick={resendResetCode} type="button">{resending ? 'Requesting…' : 'Resend reset code'}</button>}
      </form>
      <p className="mt-6 text-center text-sm text-[#68726E]"><Link className="font-semibold text-[#1B4332] hover:underline" to="/login">Back to sign in</Link></p>
    </section>
  </main>;
}
