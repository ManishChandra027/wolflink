import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { verifyEmail } from '../../features/auth/authSlice.js';
import { api, getApiMessage } from '../../lib/api.js';
import { Brand } from '../../components/Brand.jsx';
import { Button } from '../../components/common/Button.jsx';
import { FormField } from '../../components/common/FormField.jsx';
import { FeedbackMessage } from '../../components/common/FeedbackMessage.jsx';
import { toast } from 'sonner';

export function VerifyEmailPage() {
  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);
  const [otp, setOtp] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [deliveryFailed, setDeliveryFailed] = useState(() => location.state?.verificationEmailSent === false || (!location.state && sessionStorage.getItem('wolflink:verification-email-sent') === 'false'));

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await dispatch(verifyEmail({ otp })).unwrap();
      toast.success('Email verified. You can start chatting now.');
      sessionStorage.removeItem('wolflink:verification-email-sent');
      navigate('/settings', { replace: true });
    } catch (reason) {
      setError(reason || 'We could not verify that code. Please try again.');
      toast.error(reason || 'We could not verify that code. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await api.post('/auth/resend-verification');
      setMessage(response.data.data.message);
      toast.success('A new verification code was requested');
      setDeliveryFailed(false);
      sessionStorage.setItem('wolflink:verification-email-sent', 'true');
    } catch (reason) {
      setError(getApiMessage(reason));
      toast.error(getApiMessage(reason));
      setDeliveryFailed(true);
      sessionStorage.setItem('wolflink:verification-email-sent', 'false');
    } finally {
      setBusy(false);
    }
  }

  return <main className="grid min-h-screen place-items-center bg-[#F3F4F2] px-5 py-10">
    <section className="w-full max-w-md rounded-2xl border border-[#E5E7EB] bg-white p-7 shadow-sm sm:p-10">
      <Brand />
      <p className="mt-10 text-xs font-semibold uppercase tracking-[0.18em] text-[#1B4332]">One last step</p>
      <h1 className="mt-3 font-serif text-3xl text-[#0F2D1F]">Verify your email</h1>
      <p className="mt-3 text-sm leading-6 text-[#68726E]">{deliveryFailed ? 'We could not send your code yet. You can retry below or skip and verify later in Account Settings.' : 'Enter the six-digit code sent to your email. It expires in 10 minutes.'}</p>
      <form className="mt-7 space-y-5" onSubmit={submit}>
        <p className="rounded-lg bg-[#F3F4F2] px-3 py-2.5 text-sm text-[#68726E]">{deliveryFailed ? 'No code was sent to ' : 'Code sent to '}<strong className="text-[#1F1F1F]">{user?.email}</strong>.</p>
        <FormField id="otp" label="Verification code" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} />
        <FeedbackMessage>{error}</FeedbackMessage>
        <FeedbackMessage kind="success">{message}</FeedbackMessage>
        <Button className="w-full" loading={busy} disabled={otp.length !== 6} type="submit">Verify email</Button>
      </form>
      <Button className="mt-4 w-full" variant="secondary" disabled={busy || user?.emailVerified} onClick={resend}>{deliveryFailed ? 'Try sending code again' : 'Resend code'}</Button>
      <button className="mt-3 w-full px-4 py-2 text-sm text-[#68726E] underline-offset-4 hover:underline" onClick={() => { sessionStorage.removeItem('wolflink:verification-email-sent'); navigate('/', { replace: true }); }} type="button">Skip for now</button>
    </section>
  </main>;
}
