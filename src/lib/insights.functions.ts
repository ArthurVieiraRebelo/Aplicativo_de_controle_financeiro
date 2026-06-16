import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const generateInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const since = new Date();
    since.setMonth(since.getMonth() - 2);
    const sinceStr = since.toISOString().slice(0, 10);

    const { data: txs, error } = await supabase
      .from("transactions")
      .select("type,amount,occurred_on, categories(name)")
      .gte("occurred_on", sinceStr);
    if (error) throw new Error(error.message);

    const totals = (txs ?? []).reduce(
      (acc, t: any) => {
        const v = Number(t.amount);
        if (t.type === "income") acc.income += v;
        else {
          acc.expense += v;
          const k = t.categories?.name ?? "Sem categoria";
          acc.byCat[k] = (acc.byCat[k] ?? 0) + v;
        }
        return acc;
      },
      { income: 0, expense: 0, byCat: {} as Record<string, number> },
    );

    const topCats = Object.entries(totals.byCat).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const fmt = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

    const summary = `Últimos 60 dias:\n- Receitas: ${fmt(totals.income)}\n- Despesas: ${fmt(totals.expense)}\n- Saldo: ${fmt(totals.income - totals.expense)}\n- Top categorias de gasto: ${topCats.map(([k, v]) => `${k} ${fmt(v)}`).join(", ")}`;

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { text: summary + "\n\n(Configure LOVABLE_API_KEY para receber sugestões personalizadas com IA.)" };
    }

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "Você é um consultor financeiro brasileiro empático e direto. Analise os dados e gere 4 a 6 dicas curtas e práticas em português para economizar dinheiro, organizadas em bullets. Foque nas maiores categorias e em comportamentos. Não invente números.",
          },
          { role: "user", content: summary },
        ],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      if (resp.status === 429) throw new Error("Limite de uso da IA atingido. Tente novamente em alguns instantes.");
      if (resp.status === 402) throw new Error("Créditos de IA insuficientes. Adicione créditos no workspace.");
      throw new Error(`Erro IA: ${errText}`);
    }
    const json = await resp.json();
    const text = json?.choices?.[0]?.message?.content ?? "Sem resposta da IA.";
    return { text, summary };
  });
