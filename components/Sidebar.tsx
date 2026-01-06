"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/roi", label: "Impact" },
  { href: "/dashboard/pipeline", label: "Client Status" },
  { href: "/dashboard/portal", label: "Client Portal" },
  { href: "/dashboard/calendar", label: "Calendar" },
  { href: "/dashboard/settings", label: "Settings" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 glass-card border-r border-zinc-800/30 min-h-screen flex flex-col">
      <div className="p-8 flex-1">
        <h2 className="text-4xl font-semibold neon-glow tracking-wide mb-16">
          OSIRIS
        </h2>
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "text-purple-400 bg-purple-400/10 border-l-2 border-purple-400"
                    : "text-zinc-500 hover:text-zinc-300 border-l-2 border-transparent"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-8 border-t border-zinc-800/30">
        <div className="text-xs text-zinc-700 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 subtle-pulse" />
            <span className="text-emerald-400/60">System Active</span>
          </div>
          <div className="text-zinc-700">AI Infrastructure</div>
        </div>
      </div>
    </aside>
  );
}
