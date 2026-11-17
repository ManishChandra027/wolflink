import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'sonner';
import { login, register } from '../../features/auth/authSlice.js';
import { buildRegistrationPayload } from '../../features/auth/registrationPayload.js';
import { Button } from '../../components/common/Button.jsx';
import { FormField } from '../../components/common/FormField.jsx';
import { FeedbackMessage } from '../../components/common/FeedbackMessage.jsx';
import { Brand } from '../../components/Brand.jsx';
import { AuthLayout } from '../../layouts/AuthLayout.jsx';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AuthPage({ mode }) {
  const isSignup = mode === 'signup';
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { error, submitting } = useSelector((state) => state.auth);
  const [values, setValues] = useState({ name: '', username: '', email: '', identifier: '', password: '', confirmPassword: '', phone: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [visiblePassword, setVisiblePassword] = useState(false);

  function validateField(field, current = values) {
    let message = '';
    if (field === 'identifier' && !current.identifier.trim()) message = 'Enter your email, username, or phone number.';
    if (field === 'name' && isSignup && current.name.trim().length < 2) message = 'Enter your display name (at least 2 characters).';
    if (field === 'username' && isSignup && !/^[a-z0-9_]{3,24}$/.test(current.username.trim().toLowerCase())) message = 'Use 3–24 letters, numbers, or underscores.';
    if (field === 'email' && (!current.email.trim() || !emailPattern.test(current.email.trim()))) message = 'Enter a valid email address.';
    if (field === 'password') {
      if (!current.password) message = 'Enter your password.';
      else if (isSignup && current.password.length < 8) message = 'Use at least 8 characters.';
      else if (new TextEncoder().encode(current.password).length > 72) message = 'Password must be no more than 72 UTF-8 bytes.';
    }
    if (field === 'confirmPassword' && isSignup) {
      if (!current.confirmPassword) message = 'Confirm your password.';
      else if (current.confirmPassword !== current.password) message = 'Passwords do not match.';
    }
    return message;
  }

  function update(event) {
    const { name, value } = event.target;
    const nextValues = { ...values, [name]: name === 'username' ? value.toLowerCase().replace(/\s/g, '') : value };
    setValues(nextValues);
    setFieldErrors((current) => {
      const next = { ...current };
      if (Object.hasOwn(next, name)) next[name] = validateField(name, nextValues);
      if (name === 'password' && Object.hasOwn(next, 'confirmPassword')) next.confirmPassword = validateField('confirmPassword', nextValues);
      return next;
    });
  }

  function blur(field) {
    setFieldErrors((current) => ({ ...current, [field]: validateField(field) }));
  }

  async function submit(event) {
    event.preventDefault();
    const fields = isSignup ? ['name', 'username', 'email', 'password', 'confirmPassword'] : ['identifier', 'password'];
    const nextErrors = Object.fromEntries(fields.map((field) => [field, validateField(field)]).filter(([, message]) => message));
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    const action = isSignup
      ? register(buildRegistrationPayload(values))
      : login({ identifier: values.identifier.trim(), password: values.password });
    try {
      const result = await dispatch(action).unwrap();
      toast.success(isSignup ? 'Account created' : 'Signed in successfully');
      if (isSignup) sessionStorage.setItem('wolflink:verification-email-sent', String(result.verificationEmailSent !== false));
      navigate(isSignup ? '/verify-email' : '/', {
        replace: true,
        state: isSignup ? { verificationEmailSent: result.verificationEmailSent !== false } : undefined,
      });
    } catch (reason) {
      toast.error(typeof reason === 'string' ? reason : 'Please check your details and try again.');
    }
  }

  return <AuthLayout>
    <section className="flex min-h-dvh flex-col overflow-y-auto px-5 py-6 sm:px-10 lg:h-dvh lg:min-h-0 lg:px-16 xl:px-24">
      <div className="mx-auto my-auto w-full max-w-md shrink-0 py-2 sm:py-3">
        <div className={`lg:hidden ${isSignup ? 'mb-5' : 'mb-12'}`}><Brand /></div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#1B4332]">Welcome to WolfLink</p>
        <h2 className={`mt-2 font-serif text-[#0F2D1F] ${isSignup ? 'text-3xl' : 'text-4xl'}`}>{isSignup ? 'Create your account' : 'Welcome back'}</h2>
        <p className={`mt-1 text-[#68726E] ${isSignup ? 'text-xs leading-5' : 'text-sm leading-6'}`}>{isSignup ? 'Start a calmer kind of conversation.' : 'Sign in to continue your conversations.'}</p>
        {!isSignup && location.state?.verified && <p className="mt-5 rounded-lg border border-[#CFE3D5] bg-[#E8EFE9] px-3 py-2.5 text-sm text-[#1B4332]" role="status">Your email is verified. You can sign in now.</p>}
        {!isSignup && location.state?.recoveryComplete && <p className="mt-5 rounded-lg border border-[#CFE3D5] bg-[#E8EFE9] px-3 py-2.5 text-sm text-[#1B4332]" role="status">Your password was updated. Sign in with your new password.</p>}
        {!isSignup && location.state?.passwordChanged && <p className="mt-5 rounded-lg border border-[#CFE3D5] bg-[#E8EFE9] px-3 py-2.5 text-sm text-[#1B4332]" role="status">Your password was changed. Sign in with the new password.</p>}

        <form className={isSignup ? 'mt-4 grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2' : 'mt-8 space-y-4'} noValidate onSubmit={submit}>
          {isSignup && <FormField compact id="name" label="Display name" autoComplete="name" required minLength={2} maxLength={40} value={values.name} onChange={update} onBlur={() => blur('name')} error={fieldErrors.name} />}
          {isSignup && <FormField compact id="username" label="Username" autoComplete="username" autoCapitalize="none" autoCorrect="off" required minLength={3} maxLength={24} placeholder="e.g. manish_chandra" value={values.username} onChange={update} onBlur={() => blur('username')} error={fieldErrors.username} />}
          {isSignup ? <FormField compact id="email" label="Email address" type="email" autoComplete="email" required maxLength={254} value={values.email} onChange={update} onBlur={() => blur('email')} error={fieldErrors.email} /> : <FormField id="identifier" label="Email, username, or phone number" autoComplete="username" autoCapitalize="none" autoCorrect="off" placeholder="Email, username, or +91 phone" required maxLength={254} value={values.identifier} onChange={update} onBlur={() => blur('identifier')} error={fieldErrors.identifier} />}
          {isSignup && <div>
            <FormField compact id="phone" label={<>Phone number <span className="font-normal text-[#68726E]">(optional)</span></>} type="tel" autoComplete="tel" inputMode="tel" placeholder="+91 98765 43210" value={values.phone} onChange={update} />
            <span className="mt-1 block text-[10px] leading-4 text-[#68726E]">Private by default; visibility can be changed in Settings.</span>
          </div>}
          <div className="relative">
            <FormField compact={isSignup} id="password" label="Password" type={visiblePassword ? 'text' : 'password'} autoComplete={isSignup ? 'new-password' : 'current-password'} required minLength={isSignup ? 8 : 1} maxLength={72} value={values.password} onChange={update} onBlur={() => blur('password')} error={fieldErrors.password} />
            <button className={`absolute right-3 ${isSignup ? 'top-7' : 'top-9'} text-xs font-medium text-[#1B4332] hover:text-[#0F2D1F]`} onClick={() => setVisiblePassword((value) => !value)} type="button" aria-label={visiblePassword ? 'Hide password' : 'Show password'}>{visiblePassword ? 'Hide' : 'Show'}</button>
          </div>
          {isSignup && <div className="relative">
            <FormField compact id="confirmPassword" label="Confirm password" type={visiblePassword ? 'text' : 'password'} autoComplete="new-password" required maxLength={72} value={values.confirmPassword} onChange={update} onBlur={() => blur('confirmPassword')} error={fieldErrors.confirmPassword} />
          </div>}

          <div className={isSignup ? 'sm:col-span-2' : ''}><FeedbackMessage>{error}</FeedbackMessage></div>
          <Button className={`w-full ${isSignup ? 'sm:col-span-2' : ''}`} variant="gold" loading={submitting} type="submit">{isSignup ? 'Create account' : 'Sign in'}</Button>
        </form>
        {!isSignup && <p className="mt-4 text-right text-sm"><Link className="font-medium text-[#1B4332] hover:underline" to="/forgot-password">Forgot password?</Link></p>}

        <p className="mt-7 text-center text-sm text-[#68726E]">
          {isSignup ? 'Already have an account?' : 'New to WolfLink?'}{' '}
          <Link className="font-semibold text-[#1B4332] underline-offset-4 hover:underline" to={isSignup ? '/login' : '/signup'}>{isSignup ? 'Sign in' : 'Create an account'}</Link>
        </p>
      </div>
      {!isSignup && <p className="mx-auto mt-10 max-w-md text-center text-xs leading-5 text-[#68726E]">Your password is protected. WolfLink never stores your sign-in session in browser storage.</p>}
    </section>
  </AuthLayout>;
}
