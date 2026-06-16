import { createMiddleware } from '@tanstack/react-start'
import { requireSupabaseAuth } from './auth-middleware'

/**
 * Chains after requireSupabaseAuth and additionally verifies the user
 * has role = 'admin' in the profiles table. The profile query is against
 * the user's own row, so the existing "own profile" RLS policy allows it.
 */
export const requireAdminAuth = createMiddleware({ type: 'function' })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const { supabase, userId } = context

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()

    if (error || !profile || profile.role !== 'admin') {
      throw new Error('Forbidden: Admin access required')
    }

    return next({ context })
  })
