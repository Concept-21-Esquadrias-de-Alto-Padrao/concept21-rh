"use client";

import {
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Landmark,
  Settings,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PropsWithChildren } from "react";

import { CurrentUserMenu } from "@/modules/hr/components/CurrentUserMenu";
import { NotificationsBell } from "@/modules/hr/components/NotificationsBell";

const navItems = [
  { href: "/rh", label: "Dashboard", icon: LayoutDashboard },
  { href: "/rh/colaboradores", label: "Colaboradores", icon: Users },
  { href: "/rh/movimentacoes", label: "Admissoes e desligamentos", icon: UserPlus },
  { href: "/rh/folha-pagamento", label: "Folha de Pagamento", icon: Landmark },
  { href: "/rh/documentos", label: "Documentos", icon: FileText },
  { href: "/rh/ferias-afastamentos", label: "Férias e afastamentos", icon: CalendarDays },
  { href: "/rh/treinamentos", label: "Treinamentos", icon: GraduationCap },
  { href: "/rh/ocorrencias", label: "Ocorrências", icon: Bell },
  { href: "/rh/configuracoes", label: "Configurações do RH", icon: Settings },
];

export function AppShell({ children }: PropsWithChildren) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#f4f5f7] text-[#1b1f24]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col bg-[#111316] text-white shadow-2xl lg:flex">
        <div className="border-b border-white/10 px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-md bg-[#f97316] font-semibold text-white">
              C21
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#f97316]">
                Concept21
              </p>
              <h1 className="text-lg font-semibold">Aluminium RH</h1>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/rh" ? pathname === item.href : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium transition ${
                  active
                    ? "bg-[#f97316] text-white shadow-lg shadow-orange-950/20"
                    : "text-zinc-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="rounded-md border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="h-4 w-4 text-[#f97316]" />
              RBAC + RLS
            </div>
            <p className="mt-2 text-xs leading-5 text-zinc-400">
              Acesso protegido por Supabase Auth, permissões no banco e Storage privado.
            </p>
          </div>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-black/5 bg-white/90 px-4 py-3 backdrop-blur lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 lg:hidden">
              <div className="grid h-10 w-10 place-items-center rounded-md bg-[#111316] text-sm font-semibold text-white">
                C21
              </div>
              <span className="font-semibold">RH Concept21</span>
            </div>
            <div className="hidden items-center gap-2 text-sm text-zinc-500 lg:flex">
              <BriefcaseBusiness className="h-4 w-4 text-[#f97316]" />
              Plataforma interna Concept21 Aluminium
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <NotificationsBell />
              <CurrentUserMenu />
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1500px] px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
