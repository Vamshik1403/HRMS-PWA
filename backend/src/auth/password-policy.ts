import { BadRequestException } from '@nestjs/common';

const RULES: { label: string; test: (password: string) => boolean }[] = [
  { label: 'at least 8 characters', test: (p) => p.length >= 8 },
  { label: 'one uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { label: 'one lowercase letter', test: (p) => /[a-z]/.test(p) },
  { label: 'one number', test: (p) => /[0-9]/.test(p) },
  { label: 'one special character', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

export function assertPasswordMeetsPolicy(password: string) {
  const value = String(password || '');
  const failed = RULES.filter((rule) => !rule.test(value)).map((rule) => rule.label);
  if (failed.length) {
    throw new BadRequestException(
      `Password must have ${failed.join(', ')}`,
    );
  }
}
