"use client";

import { ArrowLeft, UserPlus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { fieldClassName, FormField } from "@/modules/hr/components/FormField";
import { signUpWithEmail } from "@/modules/hr/services/auth.service";
import { toUserFriendlyErrorMessage } from "@/modules/hr/utils/errors";

export function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (!fullName.trim() || !email.trim() || !password) {
        throw new Error("Nome completo, e-mail e senha são obrigatórios.");
      }

      if (password.length < 6) {
        throw new Error("A senha deve ter pelo menos 6 caracteres.");
      }

      if (password !== confirmPassword) {
        throw new Error("A confirmação de senha não confere.");
      }

      await signUpWithEmail({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        phone: phone.trim() || undefined,
      });

      setSuccess(
        "Cadastro criado. Verifique seu e-mail para confirmar o acesso. Depois disso, entre na plataforma e aguarde a liberação do Master/Admin.",
      );
      setPassword("");
      setConfirmPassword("");
    } catch (signupError) {
      setError(toUserFriendlyErrorMessage(signupError, "Não foi possível criar o cadastro."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#111316] px-4 py-10">
      <section className="w-full max-w-md rounded-md border border-white/10 bg-white p-6 shadow-2xl">
        <div className="mb-6">
          <Link
            href="/login"
            className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-zinc-500 transition hover:text-[#f97316]"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao login
          </Link>
          <div className="mb-4 grid h-12 w-12 place-items-center rounded-md bg-[#f97316] font-semibold text-white">
            C21
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f97316]">
            Concept21 Aluminium
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-950">Criar cadastro</h1>
          <p className="mt-2 text-sm text-zinc-500">
            O cadastro cria seu login. O nível de acesso será liberado depois pelo Master em
            Segurança.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
              {success}
            </div>
          ) : null}

          <FormField label="Nome completo" required>
            <input
              className={fieldClassName}
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              autoComplete="name"
            />
          </FormField>

          <FormField label="E-mail" required>
            <input
              type="email"
              className={fieldClassName}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
            />
          </FormField>

          <FormField label="Telefone">
            <input
              className={fieldClassName}
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              autoComplete="tel"
            />
          </FormField>

          <FormField label="Senha" required hint="Use pelo menos 6 caracteres.">
            <input
              type="password"
              className={fieldClassName}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
            />
          </FormField>

          <FormField label="Confirmar senha" required>
            <input
              type="password"
              className={fieldClassName}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
            />
          </FormField>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#f97316] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <UserPlus className="h-4 w-4" />
            {loading ? "Criando cadastro..." : "Criar cadastro"}
          </button>
        </form>
      </section>
    </main>
  );
}
