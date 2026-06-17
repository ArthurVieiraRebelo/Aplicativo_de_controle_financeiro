import { createServerFn } from "@tanstack/react-start"
import { requireAdminAuth } from "@/integrations/supabase/admin-middleware"

export type AdminStats = {
  total_users: number
  total_transactions: number
  total_income: number
  total_expense: number
  users_this_month: number
  transactions_this_month: number
}

export type AdminUser = {
  id: string
  full_name: string | null
  email: string
  role: "user" | "admin"
  created_at: string
  transaction_count: number
  total_income: number
  total_expense: number
}

export const getAdminStats = createServerFn({ method: "GET" })
  .middleware([requireAdminAuth])
  .handler(async ({ context }): Promise<AdminStats> => {
    const { supabase } = context
    const { data, error } = await supabase.rpc("get_admin_stats")
    if (error) throw new Error(error.message)
    return data as unknown as AdminStats
  })

export const getAdminUsers = createServerFn({ method: "GET" })
  .middleware([requireAdminAuth])
  .handler(async ({ context }): Promise<AdminUser[]> => {
    const { supabase } = context
    const { data, error } = await supabase.rpc("get_admin_users")
    if (error) throw new Error(error.message)
    return (data ?? []) as unknown as AdminUser[]
  })

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((input: unknown) => {
    const d = input as { userId: string; role: "user" | "admin" }
    if (!d?.userId || !d?.role) throw new Error("userId e role são obrigatórios")
    if (d.role !== "user" && d.role !== "admin") throw new Error("role inválido")
    return d
  })
  .handler(async ({ context, data }) => {
    const { supabase } = context
    const { error } = await supabase.rpc("set_user_role", {
      target_user_id: data.userId,
      new_role: data.role,
    })
    if (error) throw new Error(error.message)
    return { success: true }
  })

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((input: unknown) => {
    const d = input as { userId: string }
    if (!d?.userId) throw new Error("userId é obrigatório")
    return d
  })
  .handler(async ({ context, data }) => {
    const { supabase } = context
    const { error } = await supabase.rpc("admin_delete_user", {
      target_user_id: data.userId,
    })
    if (error) throw new Error(error.message)
    return { success: true }
  })
