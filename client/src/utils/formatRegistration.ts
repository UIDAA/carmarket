export interface RegistrationInfo {
  first_registered_year: number;
  first_registered_month: number | null;
  model_year: number | null;
}

function twoDigits(year: number) {
  return String(year).slice(-2).padStart(2, '0');
}

export function formatRegistration({ first_registered_year, first_registered_month, model_year }: RegistrationInfo) {
  const yy = twoDigits(first_registered_year);
  const base = first_registered_month ? `${yy}/${String(first_registered_month).padStart(2, '0')}식` : `${yy}식`;

  if (model_year && model_year !== first_registered_year) {
    return `${base}(${twoDigits(model_year)}년형)`;
  }
  return base;
}
