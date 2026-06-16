import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { generateInsights } from "@/lib/insights.functions";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/insights")({
  head: () => ({ meta: [{ title: "Insights IA — FinControl" }] }),
  component: InsightsPage,
});

function InsightsPage() {
  const fn = useServerFn(generateInsights);
  const [text, setText] = useState("");
  const m = useMutation({
    mutationFn: () => fn(),
    onSuccess: (r) => setText(r.text),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Insights com IA</h1>
        <p className="text-muted-foreground">Receba sugestões personalizadas para economizar com base nos seus gastos.</p>
      </div>

      <div className="gradient-card border border-border rounded-2xl p-6 shadow-soft">
        <div className="flex flex-col items-center text-center gap-3">
          <span className="grid h-14 w-14 place-items-center rounded-2xl gradient-primary text-primary-foreground shadow-glow">
            <Sparkles className="h-7 w-7" />
          </span>
          <h2 className="text-xl font-semibold">Analise meus gastos</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            Nossa IA examina seus últimos 60 dias e sugere onde você pode economizar.
          </p>
          <Button onClick={() => m.mutate()} disabled={m.isPending} className="gradient-primary text-primary-foreground shadow-glow mt-2">
            {m.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {m.isPending ? "Analisando…" : "Gerar insights"}
          </Button>
        </div>
      </div>

      {text && (
        <div className="gradient-card border border-border rounded-2xl p-6 shadow-soft">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />Sugestões</h3>
          <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-foreground">
            {text}
          </div>
        </div>
      )}
    </div>
  );
}
