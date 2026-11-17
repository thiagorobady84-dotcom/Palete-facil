/**
 * Utilitários para formatação e status de validade (opcional) sem erros de fuso horário.
 */

export type ExpirationStatusType = 'none' | 'ok' | 'expiring_soon' | 'expired';

export interface ExpirationInfo {
  status: ExpirationStatusType;
  formattedDate: string;
  statusLabel: string;
  daysRemaining?: number;
}

/**
 * Formata uma data ISO "YYYY-MM-DD" para "DD/MM/YYYY" sem shift de fuso horário.
 */
export function formatExpirationDate(dateStr?: string | null): string {
  if (!dateStr || !dateStr.trim()) return '';
  const clean = dateStr.trim();
  const match = clean.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`;
  }
  return clean;
}

/**
 * Avalia se uma data de validade (YYYY-MM-DD) está válida, próxima do vencimento (<= 30 dias) ou vencida.
 */
export function getExpirationInfo(dateStr?: string | null): ExpirationInfo {
  if (!dateStr || !dateStr.trim()) {
    return {
      status: 'none',
      formattedDate: '',
      statusLabel: '',
    };
  }

  const clean = dateStr.trim();
  const match = clean.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    return {
      status: 'ok',
      formattedDate: clean,
      statusLabel: `Validade: ${clean}`,
    };
  }

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  const day = parseInt(match[3], 10);

  const expiryDate = new Date(year, month, day);
  expiryDate.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffMs = expiryDate.getTime() - today.getTime();
  const daysRemaining = Math.round(diffMs / (1000 * 60 * 60 * 24));
  const formattedDate = `${match[3]}/${match[2]}/${match[1]}`;

  if (daysRemaining < 0) {
    const daysAgo = Math.abs(daysRemaining);
    return {
      status: 'expired',
      formattedDate,
      daysRemaining,
      statusLabel: daysAgo === 1 ? 'Vencido há 1 dia' : `Vencido há ${daysAgo} dias`,
    };
  }

  if (daysRemaining === 0) {
    return {
      status: 'expiring_soon',
      formattedDate,
      daysRemaining: 0,
      statusLabel: 'Vence hoje',
    };
  }

  if (daysRemaining <= 30) {
    return {
      status: 'expiring_soon',
      formattedDate,
      daysRemaining,
      statusLabel: daysRemaining === 1 ? 'Vence amanhã' : `Vence em ${daysRemaining} dias`,
    };
  }

  return {
    status: 'ok',
    formattedDate,
    daysRemaining,
    statusLabel: `Válido (${formattedDate})`,
  };
}
