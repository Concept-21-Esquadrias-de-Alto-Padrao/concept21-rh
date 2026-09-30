"use client";

import { LogIn } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { fieldClassName, FormField } from "@/modules/hr/components/FormField";
import { signInWithEmail } from "@/modules/hr/services/auth.service";
import { toUserFriendlyErrorMessage } from "@/modules/hr/utils/errors";

export function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage] = useState<string | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    const searchParams = new URLSearchParams(window.location.search);

    if (searchParams.get("confirmed") === "1") {
      return "E-mail confirmado. Entre para acessar a plataforma.";
    }

    if (searchParams.get("auth_error") === "callback") {
      return "Não foi possível confirmar o e-mail. O link pode estar expirado ou já ter sido usado. Solicite um novo e-mail de verificação ou peça ajuda ao Master/Admin.";
    }

    return null;
  });

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await signInWithEmail(email, password);
      router.push("/rh");
    } catch (loginError) {
      setError(toUserFriendlyErrorMessage(loginError, "Não foi possível entrar."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#111316] px-4 py-10">
      <section className="w-full max-w-md rounded-md border border-white/10 bg-white p-6 shadow-2xl">
        <div className="mb-6">
          <div className="mb-4 grid h-12 w-12 place-items-center rounded-md bg-[#f97316] font-semibold text-white">
            C21
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f97316]">
            Concept21 Aluminium
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-950">Acesso ao RH</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Autenticação via Supabase Auth. As permissões são aplicadas pelo RBAC do banco.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {!error && infoMessage ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
              {infoMessage}
            </div>
          ) : null}

          <FormField label="E-mail" required>
            <input
              type="email"
              className={fieldClassName}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </FormField>

          <FormField label="Senha" required>
            <input
              type="password"
              className={fieldClassName}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </FormField>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#f97316] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LogIn className="h-4 w-4" />
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <div className="mt-5 border-t border-zinc-200 pt-4 text-center text-sm text-zinc-600">
          Ainda não tem cadastro?{" "}
          <Link href="/cadastro" className="font-semibold text-[#f97316] hover:text-[#ea580c]">
            Criar acesso
          </Link>
        </div>
      </section>
    </main>
  );
}
