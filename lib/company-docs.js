import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Fixed category list with an "add new" escape hatch handled at the UI layer —
// any string is accepted here, the UI just seeds these as quick-picks.
export const DEFAULT_DOC_CATEGORIES = [
  'marketing',
  'ops',
  'fundraising',
  'recruitment',
  'uncategorized',
];

export async function listDocs({ category } = {}) {
  let query = supabase
    .from('company_docs')
    .select('*')
    .order('updated_at', { ascending: false });

  if (category) query = query.eq('category', category);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getDoc(id) {
  const { data, error } = await supabase
    .from('company_docs')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createDoc({ title, content = '', category = 'uncategorized', created_by }) {
  const { data, error } = await supabase
    .from('company_docs')
    .insert([{ title, content, category, created_by }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Last-write-wins on updated_at, consistent with the Monday/Slack sync convention
export async function updateDoc(id, updates) {
  const { data, error } = await supabase
    .from('company_docs')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteDoc(id) {
  const { error } = await supabase.from('company_docs').delete().eq('id', id);
  if (error) throw error;
}
