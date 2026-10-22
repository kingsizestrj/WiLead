// Normalizes a Brazilian (or already international) phone to digits with country code.
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if (digits.length >= 12 && digits.length <= 15) return digits;
  return null;
}

export function maskPhone(phone: string): string {
  const local = phone.startsWith("55") ? phone.slice(2) : phone;
  return `(${local.slice(0, 2)}) •••••-${local.slice(-4)}`;
}

export function formatPhone(phone: string): string {
  const local = phone.startsWith("55") ? phone.slice(2) : phone;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return `+${phone}`;
}

export function normalizeMac(input: string): string | null {
  const hex = input.replace(/[^0-9a-fA-F]/g, "").toUpperCase();
  if (hex.length !== 12) return null;
  return hex.match(/.{2}/g)!.join(":");
}
