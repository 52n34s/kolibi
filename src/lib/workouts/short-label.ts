const UMLAUT_MAP: Record<string, string> = {
  ä: 'a',
  ö: 'o',
  ü: 'u',
  Ä: 'A',
  Ö: 'O',
  Ü: 'U',
  ß: 'ss',
};

function stripDiacritics(input: string): string {
  let out = '';
  for (const ch of input) {
    out += UMLAUT_MAP[ch] ?? ch;
  }
  return out.normalize('NFD').replace(/\p{M}/gu, '');
}

/** Letters only (after umlaut fold); drops emoji, punctuation, spaces. */
function lettersOnly(name: string): string {
  return stripDiacritics(name).replace(/[^\p{L}]/gu, '');
}

function isConsonant(ch: string): boolean {
  const lower = ch.toLowerCase();
  return /[a-z]/i.test(lower) && !'aeiou'.includes(lower);
}

/**
 * Suggest a 1–2 character short label from a unit name.
 * First letter uppercased; on collision append next consonant (then any letter).
 * Returns '' for a name without letters — the caller must not invent one.
 */
export function suggestShortLabel(name: string, existingLabels: readonly string[]): string {
  const taken = new Set(existingLabels.map((label) => label.toLocaleUpperCase('en')));
  const letters = lettersOnly(name);
  // No letters to work with → no suggestion. An invented 'X' used to be written
  // into the field before the user had typed anything, and saving kept it.
  if (letters.length === 0) {
    return '';
  }

  const first = letters[0]!.toLocaleUpperCase('en');
  if (!taken.has(first)) {
    return first;
  }

  for (let i = 1; i < letters.length; i += 1) {
    const ch = letters[i]!;
    if (!isConsonant(ch)) {
      continue;
    }
    const candidate = `${first}${ch.toLocaleLowerCase('en')}`;
    if (!taken.has(candidate.toLocaleUpperCase('en'))) {
      return candidate.length > 2 ? candidate.slice(0, 2) : candidate;
    }
  }

  for (let i = 1; i < letters.length; i += 1) {
    const candidate = `${first}${letters[i]!.toLocaleLowerCase('en')}`;
    if (!taken.has(candidate.toLocaleUpperCase('en'))) {
      return candidate.slice(0, 2);
    }
  }

  for (const suffix of 'bcdfghjklmnpqrstvwxyz') {
    const candidate = `${first}${suffix}`;
    if (!taken.has(candidate.toLocaleUpperCase('en'))) {
      return candidate;
    }
  }

  return first.slice(0, 2);
}
