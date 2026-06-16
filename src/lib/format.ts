export const formatBRL = (n: number | string | null | undefined) => {
  const v = typeof n === "string" ? parseFloat(n) : (n ?? 0);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(v) ? (v as number) : 0);
};

export const formatDate = (d: string | Date) => {
  const date = typeof d === "string" ? new Date(d + (d.length === 10 ? "T00:00:00" : "")) : d;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
};

export const monthLabel = (m: number) =>
  ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][m - 1];

export const paymentMethodLabel: Record<string, string> = {
  cash: "Dinheiro",
  debit: "Débito",
  credit: "Crédito",
  pix: "Pix",
  transfer: "Transferência",
  other: "Outro",
};
