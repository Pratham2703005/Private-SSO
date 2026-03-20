/**
 * Shared avatar color mapping based on first character (A-Z).
 * Multiple characters can intentionally map to the same color.
 */

const COLOR_GROUPS = [
  { letters: ['A', 'B', 'C', 'D'], color: '#1d4ed8' },
  { letters: ['E', 'F', 'G'], color: '#0f766e' },
  { letters: ['H', 'I', 'J'], color: '#b45309' },
  { letters: ['K', 'L', 'M'], color: '#7c3aed' },
  { letters: ['N', 'O', 'P'], color: '#be123c' },
  { letters: ['Q', 'R', 'S'], color: '#0369a1' },
  { letters: ['T', 'U', 'V'], color: '#047857' },
  { letters: ['W', 'X', 'Y', 'Z'], color: '#334155' },
] as const;

const DEFAULT_AVATAR_COLOR = '#475569';

function buildAvatarColorMap(): Record<string, string> {
  const map: Record<string, string> = {};

  for (let code = 65; code <= 90; code += 1) {
    map[String.fromCharCode(code)] = DEFAULT_AVATAR_COLOR;
  }

  for (const group of COLOR_GROUPS) {
    for (const letter of group.letters) {
      map[letter] = group.color;
    }
  }

  return map;
}

export const AVATAR_CHAR_COLOR_MAP = buildAvatarColorMap();

export function getAvatarColorByChar(char?: string | null): string {
  const normalized = (char || '').trim().charAt(0).toUpperCase();
  return AVATAR_CHAR_COLOR_MAP[normalized] || DEFAULT_AVATAR_COLOR;
}

export function getAvatarColorByName(name?: string | null): string {
  return getAvatarColorByChar(name || '');
}
