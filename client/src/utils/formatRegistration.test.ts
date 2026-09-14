import { describe, expect, it } from 'vitest';
import { formatRegistration } from './formatRegistration';

describe('formatRegistration', () => {
  it('formats year+month without model year as "YY/MM식"', () => {
    expect(formatRegistration({ first_registered_year: 2017, first_registered_month: 7, model_year: null })).toBe('17/07식');
  });

  it('formats year+month+different model year with a parenthetical', () => {
    expect(formatRegistration({ first_registered_year: 2015, first_registered_month: 9, model_year: 2016 })).toBe(
      '15/09식(16년형)'
    );
  });

  it('omits the parenthetical when model_year equals first_registered_year', () => {
    expect(formatRegistration({ first_registered_year: 2021, first_registered_month: 3, model_year: 2021 })).toBe(
      '21/03식'
    );
  });

  it('omits the month segment when first_registered_month is null', () => {
    expect(formatRegistration({ first_registered_year: 2015, first_registered_month: null, model_year: null })).toBe(
      '15식'
    );
  });
});
