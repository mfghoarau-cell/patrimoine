/**
 * Code d'accès : un simple verrou d'écran. Les données ne sont pas chiffrées ; le code empêche
 * seulement qu'un proche ouvre l'application par-dessus ton épaule.
 */
export const hashPin = async (pin: string): Promise<string> => {
  const salted = `patrimoine:${pin}`;
  if (globalThis.crypto?.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salted));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Repli pour un contexte non sécurisé (adresse http locale) : empreinte simple.
  let h = 0;
  for (let i = 0; i < salted.length; i += 1) h = (Math.imul(31, h) + salted.charCodeAt(i)) | 0;
  return `fallback-${h}`;
};
