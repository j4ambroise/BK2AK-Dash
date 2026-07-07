import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export const DEFAULT_DOC_CATEGORIES = [
  'marketing',
  'ops',
  'fundraising',
  'recruitment',
  'uncategorized',
] as const

export interface CompanyDoc {
  id: string
  title: string
  content: string
  category: string
  created_by: string | null
  created_at: string
  updated_at: string
}

export async function listDocs({ category }: { category?: string } = {}): Promise<CompanyDoc[]> {
  let query = supabase
    .from('company_docs')
    .select('*')
    .order('updated_at', { ascending: false })

  if (category) query = query.eq('category', category)

  const { data, error } = await query
  if (error) throw error
  return data as CompanyDoc[]
}

export async function getDoc(id: string): Promise<CompanyDoc> {
  const { data, error } = await supabase.from('company_docs').select('*').eq('id', id).single()
  if (error) throw error
  return data as CompanyDoc
}

export async function createDoc({
  title,
  content = '',
  category = 'uncategorized',
  created_by,
}: {
  title: string
  content?: string
  category?: string
  created_by?: string
}): Promise<CompanyDoc> {
  const { data, error } = await supabase
    .from('company_docs')
    .insert([{ title, content, category, created_by }])
    .select()
    .single()

  if (error) throw error
  return data as CompanyDoc
}

// Last-write-wins on updated_at, consistent with the Monday sync convention
export async function updateDoc(id: string, updates: Partial<CompanyDoc>): Promise<CompanyDoc> {
  const { data, error } = await supabase
    .from('company_docs')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as CompanyDoc
}

export async function deleteDoc(id: string): Promise<void> {
  const { error } = await supabase.from('company_docs').delete().eq('id', id)
  if (error) throw error
}
