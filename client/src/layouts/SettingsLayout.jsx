import { Link, NavLink, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Brand } from "../components/Brand.jsx";

const sections = [
  { path: "/settings/profile", label: "My profile", icon: "◉" },
  { path: "/settings/edit-profile", label: "Edit profile", icon: "✎" },
  { path: "/settings/account", label: "Account", icon: "◎" },
  { path: "/settings/privacy", label: "Privacy", icon: "◇" },
  { path: "/settings/security", label: "Password & security", icon: "⌑" },
  { path: "/settings/appearance", label: "Appearance", icon: "◐" },
  {
    path: "/settings/notifications",
    label: "Notifications",
    icon: "♧",
  },
  { path: "/settings/about", label: "About WolfLink", icon: "ⓘ" },
  {
    path: "/settings/terms",
    label: "Terms & policies",
    icon: "▤",
    future: true,
  },
];

export function SettingsLayout({ children }) {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <main className="min-h-dvh bg-[#F3F4F2] text-[#1F1F1F] lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="scrollbar-hidden border-b border-[#E5E7EB] bg-[#061F17] px-5 py-5 text-white lg:sticky lg:top-0 lg:h-dvh lg:overflow-y-auto lg:border-b-0 lg:border-r lg:border-white/10 lg:px-5 lg:py-7">
        <div className="flex items-center justify-between gap-4 lg:block">
          <Brand />
          <Link
            className="shrink-0 rounded-lg border border-white/15 px-3 py-2 text-xs text-[#E8EFE9] hover:bg-white/10 lg:mt-8 lg:inline-flex"
            to="/"
          >
            ← Back to chats
          </Link>
        </div>
        <div className="mt-6 hidden lg:block">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#E8EFE9]/45">
            Workspace
          </p>
          <h1 className="mt-1 font-serif text-2xl">Settings</h1>
        </div>
        <nav
          aria-label="Settings sections"
          className="mt-5 flex gap-2 overflow-x-auto pb-1 lg:mt-7 lg:flex-col lg:overflow-visible lg:pb-0"
        >
          {sections.map(({ path, label, icon, future }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition focus-visible:outline-2 focus-visible:outline-[#D4AF37] lg:w-full ${isActive ? "bg-[#1B4332] text-white shadow-sm" : "text-[#E8EFE9]/75 hover:bg-white/10 hover:text-white"}`
              }
            >
              <span
                className="grid size-5 place-items-center text-[#D4AF37]"
                aria-hidden="true"
              >
                {icon}
              </span>
              <span>{label}</span>
              {future && (
                <span className="ml-auto hidden rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-[#E8EFE9]/55 lg:inline">
                  Soon
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <p className="mt-8 hidden text-xs leading-5 text-[#E8EFE9]/45 lg:block">
          Make your WolfLink space feel like yours.
        </p>
      </aside>
      <div className="min-w-0 px-4 py-6 sm:px-7 sm:py-8 lg:px-10 lg:py-10">
        <div className="mx-auto w-full max-w-4xl">{children}</div>
      </div>
    </main>
  );
}
