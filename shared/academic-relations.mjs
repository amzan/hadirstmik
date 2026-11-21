export const ROMBEL_RULE_VERSION = 'owner-confirmed-2026-11-20';
export const ROMBEL_ALIASES = Object.freeze({ 'TI 1': 'TI 1A' });

export function canonicalRombel(value) {
  const code = String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
  return ROMBEL_ALIASES[code] || code;
}

export function splitRombels(value) {
  const parts = (Array.isArray(value) ? value : [value]).flatMap(v => String(v || '').split(/[,;&/]+/));
  let prefix = '';
  const codes = [];
  for (const part of parts) {
    let code = part.trim().toUpperCase().replace(/\s+/g, ' ');
    if (!code) continue;
    const match = code.match(/^(TI|MI)\s+/);
    if (match) prefix = match[1];
    else if (/^\d+[A-Z]*$/.test(code) && prefix) code = `${prefix} ${code}`;
    codes.push(canonicalRombel(code));
  }
  return [...new Set(codes)];
}

export function sameRombelMembership(student, schedule) {
  const codes = new Set(splitRombels(student));
  return splitRombels(schedule).some(code => codes.has(code));
}
