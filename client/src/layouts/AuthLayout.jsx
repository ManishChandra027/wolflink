import { Brand } from '../components/Brand.jsx';

export function AuthLayout({ children }) {
  return <main className="auth-layout min-h-dvh bg-[#F8F8F6] lg:grid lg:h-dvh lg:grid-cols-[minmax(340px,0.9fr)_1.1fr] lg:overflow-hidden">
    <section className="relative hidden min-h-0 flex-col justify-between overflow-hidden bg-[#061F17] p-12 text-white lg:flex xl:p-16">
      <Brand />
      <div className="relative z-10 max-w-lg pb-8"><p className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-[#D4AF37]">A quieter place to connect</p><h1 className="font-serif text-5xl leading-tight">Better conversations, one connection at a time.</h1><p className="mt-6 max-w-md leading-7 text-[#E8EFE9]/75">A thoughtful space for your one-to-one conversations. Simple, personal, and ready wherever you are.</p></div>
      <p className="text-xs text-[#E8EFE9]/55">WolfLink · Stay Connected.</p>
      <div className="pointer-events-none absolute -bottom-40 -right-24 size-[27rem] rounded-full border border-[#D4AF37]/10" />
      <div className="pointer-events-none absolute -bottom-24 -right-8 size-[20rem] rounded-full border border-[#D4AF37]/10" />
    </section>
    {children}
  </main>;
}
