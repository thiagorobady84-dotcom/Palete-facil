/**
 * Normaliza strings para buscas desconsiderando acentuação, caracteres especiais e maiúsculas/minúsculas.
 * Exemplo: "Açúcar Cristal" -> "acucar cristal"
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Formata um código de pallet caso o usuário digite apenas números.
 * Ex: "1" -> "P01", "2" -> "P02", "P3" -> "P03", "P01" -> "P01"
 */
export function formatPalletCode(input: string): string {
  const cleaned = input.trim().toUpperCase();
  if (!cleaned) return '';
  if (/^\d+$/.test(cleaned)) {
    const num = parseInt(cleaned, 10);
    return `P${num < 10 ? '0' : ''}${num}`;
  }
  if (/^P\d+$/i.test(cleaned)) {
    const num = parseInt(cleaned.slice(1), 10);
    return `P${num < 10 ? '0' : ''}${num}`;
  }
  return cleaned;
}
