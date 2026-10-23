"use client";

import { CheckCircle2, Eye, EyeOff, KeyRound, LogIn } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { fieldClassName, FormField } from "@/modules/hr/components/FormField";
import { LoadingState } from "@/modules/hr/components/LoadingState";
import { PageHeader } from "@/modules/hr/components/PageHeader";
import { getCurrentUserAccess, signOut, updateHomologationPassword, type CurrentUserAccess } from "@/modules/hr/services/auth.service";
import { toUserFriendlyErrorMessage } from "@/modules/hr/utils/errors";
import { HOMOLOGATION_PASSWORD_MAX_LENGTH, HOMOLOGATION_PASSWORD_MIN_LENGTH, validateNewPassword } from "@/modules/hr/utils/password";

export function AccountPasswordPage() {
  const router = useRouter();
  const [access, setAccess] = useState<CurrentUserAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getCurrentUserAccess().then((current) => {
      if (!active) return;
      if (!current?.profile?.is_active || !current.emailConfirmed) {
        setError("Entre com seu link pessoal de homologação para definir a senha.");
        return;
      }
      setAccess(current);
    }).catch((loadError: unknown) => {
      if (active) setError(toUserFriendlyErrorMessage(loadError, "Não foi possível conferir a conta conectada. Recarregue a página."));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!access || saving) return;
    setError(null);
    const validation = validateNewPassword(password, confirmation);
    if (validation) { setError(validation); return; }
    setSaving(true);
    try {
      await updateHomologationPassword(password, confirmation, access.authUserId);
      setPassword("");
      setConfirmation("");
      setVisible(false);
      setSaved(true);
    } catch (saveError) {
      setError(toUserFriendlyErrorMessage(saveError, "Não foi possível definir a senha. Tente novamente."));
    } finally {
      setSaving(false);
    }
  }

  async function returnToLogin() {
    setSaving(true);
    try {
      await signOut();
      router.replace("/login?password_updated=1");
      router.refresh();
    } catch {
      setError("A senha já foi definida, mas não foi possível encerrar a sessão. Tente sair novamente pelo cabeçalho.");
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="Senha da homologação" eyebrow="Minha conta" />
      {loading ? <LoadingState label="Conferindo sua conta..." /> : (
        <div className="max-w-xl">
          {access ? <p className="mb-6 break-all text-sm text-zinc-600">Conta conectada: <strong className="text-zinc-900">{access.email}</strong></p> : null}
          {error ? <p role="alert" className="mb-5 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
          {saved ? (
            <div role="status" className="space-y-5">
              <p className="flex items-start gap-2 text-sm text-emerald-800"><CheckCircle2 className="h-5 w-5 flex-none" />Senha definida. Nos próximos acessos, use seu e-mail e essa senha na homologação.</p>
              <button type="button" onClick={returnToLogin} disabled={saving} className="inline-flex items-center gap-2 rounded-md bg-[#f97316] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#ea580c] disabled:opacity-60"><LogIn className="h-4 w-4" />{saving ? "Saindo..." : "Entrar com a nova senha"}</button>
              <Link href="/rh" className="block text-sm font-medium text-zinc-600 hover:text-orange-700">Voltar ao Dashboard</Link>
            </div>
          ) : access ? (
            <form onSubmit={submit} className="space-y-5">
              <FormField label="Nova senha" htmlFor="homologation-password" required hint="Pelo menos 12 caracteres. Não reutilize a senha da produção.">
                <div className="relative">
                  <input id="homologation-password" name="new-password" type={visible ? "text" : "password"} autoComplete="new-password" required minLength={HOMOLOGATION_PASSWORD_MIN_LENGTH} maxLength={HOMOLOGATION_PASSWORD_MAX_LENGTH} className={`${fieldClassName} pr-12`} value={password} onChange={(event) => setPassword(event.target.value)} disabled={saving} />
                  <button type="button" onClick={() => setVisible((value) => !value)} aria-label={visible ? "Ocultar senhas" : "Mostrar senhas"} title={visible ? "Ocultar senhas" : "Mostrar senhas"} aria-pressed={visible} className="absolute right-1 top-1 grid h-8 w-9 place-items-center rounded text-zinc-500 hover:bg-zinc-100">{visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                </div>
              </FormField>
              <FormField label="Confirmar nova senha" htmlFor="homologation-password-confirmation" required>
                <input id="homologation-password-confirmation" name="confirm-password" type={visible ? "text" : "password"} autoComplete="new-password" required minLength={HOMOLOGATION_PASSWORD_MIN_LENGTH} maxLength={HOMOLOGATION_PASSWORD_MAX_LENGTH} className={fieldClassName} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={saving} />
              </FormField>
              <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-md bg-[#f97316] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#ea580c] disabled:cursor-wait disabled:opacity-60"><KeyRound className="h-4 w-4" />{saving ? "Salvando..." : "Definir senha"}</button>
            </form>
          ) : <Link href="/login" className="inline-flex items-center gap-2 text-sm font-semibold text-orange-700"><LogIn className="h-4 w-4" />Voltar ao login</Link>}
        </div>
      )}
    </div>
  );
}
