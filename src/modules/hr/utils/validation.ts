export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateCpf(cpf: string) {
  const digits = cpf.replace(/\D/g, "");

  if (digits.length !== 11 || /^(\d)\1+$/.test(digits)) {
    return false;
  }

  const calculateDigit = (base: string, factor: number) => {
    const total = base
      .split("")
      .reduce((sum, digit) => sum + Number(digit) * factor--, 0);
    const remainder = (total * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  const firstDigit = calculateDigit(digits.slice(0, 9), 10);
  const secondDigit = calculateDigit(digits.slice(0, 10), 11);

  return firstDigit === Number(digits[9]) && secondDigit === Number(digits[10]);
}

export function validateEmail(email?: string | null) {
  if (!email) {
    return true;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validateRequiredEmployeeFields(input: {
  full_name?: string;
  cpf?: string;
  employee_number?: string;
  hire_date?: string;
  email?: string | null;
}) {
  const errors: string[] = [];

  if (!input.full_name?.trim()) {
    errors.push("Nome completo é obrigatório.");
  }

  if (!input.cpf?.trim()) {
    errors.push("CPF é obrigatório.");
  } else if (!validateCpf(input.cpf)) {
    errors.push("CPF inválido.");
  }

  if (!input.employee_number?.trim()) {
    errors.push("Matrícula é obrigatória.");
  }

  if (!input.hire_date) {
    errors.push("Data de admissão é obrigatória.");
  }

  if (!validateEmail(input.email)) {
    errors.push("E-mail inválido.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
