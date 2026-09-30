export interface OccurrenceTypeClassification {
  key?: string | null;
  name?: string | null;
  include_in_daily_report?: boolean | null;
  counts_as_absence?: boolean | null;
  counts_as_medical_certificate?: boolean | null;
}

export function normalizeOccurrenceTypeText(type?: OccurrenceTypeClassification | null) {
  return `${type?.key ?? ""} ${type?.name ?? ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function isDelayOccurrenceType(type?: OccurrenceTypeClassification | null) {
  return normalizeOccurrenceTypeText(type).includes("atraso");
}

export function isWarningOccurrenceType(type?: OccurrenceTypeClassification | null) {
  return normalizeOccurrenceTypeText(type).includes("advertencia");
}

export function isNonDayImpactingOccurrenceType(type?: OccurrenceTypeClassification | null) {
  return isWarningOccurrenceType(type) || isDelayOccurrenceType(type);
}

export function isMedicalCertificateOccurrenceType(type?: OccurrenceTypeClassification | null) {
  const value = normalizeOccurrenceTypeText(type);

  if (isNonDayImpactingOccurrenceType(type)) {
    return false;
  }

  return Boolean(type?.counts_as_medical_certificate) || value.includes("atestado");
}

export function isAbsenceOccurrenceType(type?: OccurrenceTypeClassification | null) {
  const value = normalizeOccurrenceTypeText(type);

  if (isNonDayImpactingOccurrenceType(type)) {
    return false;
  }

  return (
    Boolean(type?.counts_as_absence) ||
    value.includes("falta") ||
    value.includes("ausencia") ||
    value.includes("afastamento") ||
    value.includes("suspensao")
  );
}

export function isDayImpactingOccurrenceType(type?: OccurrenceTypeClassification | null) {
  if (isNonDayImpactingOccurrenceType(type)) {
    return false;
  }

  return isAbsenceOccurrenceType(type) || isMedicalCertificateOccurrenceType(type);
}

export function isDailyReportOccurrenceType(type?: OccurrenceTypeClassification | null) {
  return Boolean(type?.include_in_daily_report) && isDayImpactingOccurrenceType(type);
}

export function isPayrollRelevantOccurrenceType(type?: OccurrenceTypeClassification | null) {
  return isDayImpactingOccurrenceType(type) || isDelayOccurrenceType(type);
}
