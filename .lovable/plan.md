# FinControl — Plano de Construção

Sistema completo de controle financeiro pessoal, com design inspirado em fintechs (Nubank, Inter, C6), modo claro/escuro, dashboard com gráficos, relatórios e IA para sugestões.

## Stack
- TanStack Start (React 19) + Tailwind v4 + shadcn/ui
- Lovable Cloud (Supabase) para banco, auth e RLS
- Recharts para gráficos
- Lovable AI Gateway (Gemini) para sugestões de economia
- jsPDF + SheetJS para exportar relatórios (PDF/Excel)

## Design
Visual fintech moderno: paleta roxo/violeta vibrante (estilo Nubank) com acentos verdes (receita) e vermelhos (despesa), cards com gradientes sutis, tipografia clean (Inter), bordas arredondadas generosas, dark mode como padrão. Tudo via tokens semânticos em `src/styles.css`.

## Banco de Dados (Lovable Cloud)
- `profiles` — nome, email, avatar, criado em (trigger ao signup)
- `categories` — id, user_id, nome, tipo (income/expense), ícone, cor (categorias padrão criadas no signup + customizadas)
- `transactions` — id, user_id, tipo, título, valor, categoria_id, data, forma_pagamento, observação
- `budgets` — id, user_id, categoria_id, valor_limite, mês/ano
- `goals` — id, user_id, título, valor_meta, valor_atual, prazo

Todas com RLS escopada por `auth.uid()`.

## Rotas
- `/auth` — login / cadastro / esqueci a senha
- `/reset-password` — nova senha
- `/_authenticated/` (gate gerenciado)
  - `/` dashboard (cards resumo + gráficos pizza/barras/linha)
  - `/transactions` — listagem, filtros, busca, CRUD receitas/despesas
  - `/categories` — gerenciar categorias customizadas
  - `/budgets` — orçamentos mensais + alertas
  - `/goals` — metas financeiras
  - `/reports` — relatórios com filtros + export PDF/Excel
  - `/insights` — sugestões de IA com base nos gastos
  - `/profile` — alterar nome/email/senha, excluir conta

## Funcionalidades por RF
- RF01-02 Auth: email/senha + Google, recuperação de senha
- RF03-04 CRUD receitas/despesas com modais
- RF05 Dashboard: saldo, receitas, despesas, economia do mês + 3 gráficos
- RF06 Relatórios filtráveis com export
- RF07 Filtros, busca, ordenação
- RF08 Perfil completo
- Extras: orçamentos, metas, alertas, IA, categorias customizáveis, dark mode

## Entrega em fases (nesta ordem, num único build)
1. Cloud + schema + RLS + seed de categorias padrão
2. Design system (tokens, gradientes, sombras)
3. Auth (login/signup/reset) + layout autenticado com sidebar
4. Dashboard + cards + gráficos
5. Transações (CRUD + filtros)
6. Categorias, orçamentos, metas
7. Relatórios + export
8. Insights IA + Perfil
9. SEO (sitemap/robots) e polish

## Perguntas antes de começar
1. **Login social Google** além de email/senha? (recomendado)
2. **Moeda padrão**: BRL (R$)?
3. **IA insights** usando Lovable AI Gateway (Gemini grátis até 13/out)? Ok ativar?
