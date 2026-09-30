"use client";

import { AlertTriangle, LogIn } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  getCurrentUserAccess,
  isAuthUserEmailConfirmed,
  requestCurrentUserAccessReview,
  signOut,
  type CurrentUserAccess,
} from "@/modules/hr/services/auth.service";
import { toUserFriendlyErrorMessage } from "@/modules/hr/utils/errors";

type AuthGateState =
  | { status: "loading" }
  | { status: "ready"; access: CurrentUserAccess }
  | { status: "pending-access"; access: CurrentUserAccess; requestId: string | null }
  | { status: "unverified-email"; email?: string | null }
  | { status: "inactive-profile"; email?: string | null }
  | { status: "missing-profile"; email?: string | null; authUserId?: string | null }
  | { status: "error"; message: string };

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<AuthGateState>({ status: "loading" });

  useEffect(() => {
    let active = true;

    async function loadAuthState() {
      try {
        const supabase = getSupabaseBrowserClient();
        const session = await supabase.auth.getSession();

        if (!session.data.session) {
          router.replace("/login");
          return;
        }

        if (!isAuthUserEmailConfirmed(session.data.session.user)) {
          await signOut();

          if (!active) {
            return;
          }

          setState({
            status: "unverified-email",
            email: session.data.session.user.email,
          });
          return;
        }

        const access = await getCurrentUserAccess();

        if (!active) {
          return;
        }

        if (!access?.profile) {
          setState({
            status: "missing-profile",
            email: session.data.session.user.email,
            authUserId: session.data.session.user.id,
          });
          return;
        }

        if (!access.profile.is_active) {
          await signOut();

          if (!active) {
            return;
          }

          setState({
            status: "inactive-profile",
            email: access.profile.email ?? access.email,
          });
          return;
        }

        if (access.roles.length === 0) {
          let requestId: string | null = null;

          try {
            requestId = await requestCurrentUserAccessReview();
          } catch (requestError) {
            console.warn("Access review request failed", requestError);
          }

          if (!active) {
            return;
          }

          setState({ status: "pending-access", access, requestId });
          return;
        }

        setState({ status: "ready", access });
      } catch (error) {
        if (!active) {
          return;
        }

        setState({
          status: "error",
          message: toUserFriendlyErrorMessage(error, "Não foi possível validar a sessão."),
        });
      }
    }

    loadAuthState();

    return () => {
      active = false;
    };
  }, [router]);

  async function exitToLogin() {
    try {
      await signOut();
      router.replace("/login");
      router.refresh();
    } catch (error) {
      setState({
        status: "error",
        message: toUserFriendlyErrorMessage(error, "Não foi possível sair da plataforma."),
      });
    }
  }

  if (state.status === "loading") {
    return (
      <div className="rounded-md border border-zinc-200 bg-white p-5 text-sm text-zinc-600 shadow-sm">
        Validando sessão...
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        {state.message}
      </div>
    );
  }

  if (state.status === "unverified-email") {
    return (
      <div className="rounded-md border border-orange-200 bg-orange-50 p-5 text-sm text-orange-900">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-none" />
          <div className="min-w-0">
            <p className="font-semibold">Confirme seu e-mail para acessar.</p>
            <p className="mt-2">
              Sua sessão foi encerrada porque o e-mail ainda não foi confirmado. Use o link de
              verificação enviado para {state.email ?? "seu e-mail"} e tente entrar novamente.
            </p>
            <Link
              href="/login"
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-[#f97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ea580c]"
            >
              <LogIn className="h-4 w-4" />
              Voltar ao login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (state.status === "inactive-profile") {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-5 text-sm text-red-800">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-none" />
          <div className="min-w-0">
            <p className="font-semibold">Cadastro sem acesso ativo.</p>
            <p className="mt-2">
              Este cadastro foi inativado ou recusado pelo Master. Entre com outro usuário ou
              solicite a revisão do acesso internamente.
            </p>
            <Link
              href="/login"
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-[#f97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ea580c]"
            >
              <LogIn className="h-4 w-4" />
              Entrar com outro usuário
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (state.status === "missing-profile") {
    return (
      <div className="rounded-md border border-orange-200 bg-orange-50 p-5 text-sm text-orange-900">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-none" />
          <div className="min-w-0">
            <p className="font-semibold">Cadastro autenticado, aguardando vínculo no sistema.</p>
            <p className="mt-2">
              Seu login foi confirmado, mas ainda não existe um perfil interno vinculado ao seu
              cadastro. Peça a um usuário Master/Admin para revisar seu acesso em Configurações do
              RH &gt; Segurança e acessos.
            </p>
            <div className="mt-3 rounded-md bg-white p-3 font-mono text-xs text-zinc-700">
              <p>E-mail: {state.email ?? "-"}</p>
            </div>
            <Link
              href="/login"
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-[#f97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ea580c]"
            >
              <LogIn className="h-4 w-4" />
              Entrar com outro usuário
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (state.status === "pending-access") {
    return (
      <div className="rounded-md border border-orange-200 bg-orange-50 p-5 text-sm text-orange-900">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-none" />
          <div className="min-w-0">
            <p className="font-semibold">Cadastro confirmado, aguardando liberação de acesso.</p>
            <p className="mt-2">
              Seu e-mail já foi confirmado, mas seu usuário ainda não possui um perfil de acesso.
              Peça a um usuário Master/Admin para liberar seu cadastro em Configurações do RH &gt;
              Segurança e acessos.
            </p>
            {state.requestId ? (
              <p className="mt-2 font-mono text-xs text-orange-800">
                Solicitação: {state.requestId}
              </p>
            ) : (
              <p className="mt-2 text-xs text-orange-800">
                A solicitação automática não pode ser registrada agora. Avise o Master/Admin e
                informe seu e-mail de cadastro.
              </p>
            )}
            <button
              type="button"
              onClick={exitToLogin}
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-[#f97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ea580c]"
            >
              <LogIn className="h-4 w-4" />
              Entrar com outro usuário
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
