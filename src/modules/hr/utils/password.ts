export const HOMOLOGATION_PASSWORD_MIN_LENGTH = 12;
export const HOMOLOGATION_PASSWORD_MAX_LENGTH = 128;

export function validateNewPassword(password: string, confirmation: string) {
  if (!password.trim()) {
    return "Escolha uma senha que não seja composta apenas por espaços.";
  }
  if (password.length < HOMOLOGATION_PASSWORD_MIN_LENGTH) {
    return "Use uma senha com pelo menos 12 caracteres.";
  }
  if (password.length > HOMOLOGATION_PASSWORD_MAX_LENGTH) {
    return "Use uma senha com no máximo 128 caracteres.";
  }
  if (password !== confirmation) {
    return "As senhas não coincidem. Confira a confirmação.";
  }
  return null;
}

export function passwordUpdateErrorMessage(error: { code?: string; message?: string }) {
  if (error.code === "weak_password") {
    return "Essa senha não atende aos requisitos de segurança. Escolha uma senha mais forte e tente novamente.";
  }
  if (error.code === "same_password") {
    return "A nova senha deve ser diferente da senha atual.";
  }
  if (["reauthentication_needed", "reauthentication_not_valid", "session_not_found", "user_not_found", "bad_jwt"].includes(error.code ?? "")) {
    return "Sua sessão precisa ser renovada. Solicite um novo link pessoal de homologação e tente novamente.";
  }
  if (error.code === "over_request_rate_limit") {
    return "Houve muitas tentativas. Aguarde alguns minutos e tente novamente.";
  }
  if (/failed to fetch|networkerror/i.test(error.message ?? "")) {
    return "Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.";
  }
  return "Não foi possível definir a senha. Tente novamente; se continuar, avise o responsável pela homologação.";
}
