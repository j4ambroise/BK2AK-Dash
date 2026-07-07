import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchMondayItems, createMondayItem, updateMondayItem } from '@/lib/monday-client'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface TaskRow {
  id: string
  monday_item_id: string | null
  title: string
  status: string
  priority: string
  assignee: string | null
  due_date: string | null
  notes: string | null
  updated_at: string
}

// Pull latest from Monday and upsert into company_tasks.
// Conflict rule: last-write-wins on updated_at — if the local row was edited
// more recently than Monday's copy, keep the local version and re-push it to Monday.
async function syncFromMonday() {
  const mondayItems = await fetchMondayItems()

  for (const item of mondayItems) {
    const { data: existing } = await supabase
      .from('company_tasks')
      .select('*')
      .eq('monday_item_id', item.monday_item_id)
      .maybeSingle<TaskRow>()

    if (!existing) {
      await supabase.from('company_tasks').insert([
        {
          monday_item_id: item.monday_item_id,
          title: item.title,
          status: item.status,
          priority: item.priority,
          assignee: item.assignee,
          due_date: item.due_date,
          notes: item.notes,
          last_synced_at: new Date().toISOString(),
        },
      ])
      continue
    }

    const localUpdatedAt = new Date(existing.updated_at).getTime()
    const mondayUpdatedAt = new Date(item.monday_updated_at).getTime()

    if (mondayUpdatedAt >= localUpdatedAt) {
      await supabase
        .from('company_tasks')
        .update({
          title: item.title,
          status: item.status,
          priority: item.priority,
          assignee: item.assignee,
          due_date: item.due_date,
          notes: item.notes,
          last_synced_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
    } else {
      await updateMondayItem(existing.monday_item_id!, {
        status: existing.status,
        priority: existing.priority,
        dueDate: existing.due_date ?? undefined,
        notes: existing.notes ?? undefined,
      })
      await supabase
        .from('company_tasks')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('id', existing.id)
    }
  }
}

export async function GET() {
  try {
    await syncFromMonday()
    const { data, error } = await supabase
      .from('company_tasks')
      .select('*')
      .order('due_date', { ascending: true, nullsFirst: false })

    if (error) throw error
    return NextResponse.json(data)
  } catch (err) {
    console.error('company-tasks GET error:', err)
    return NextResponse.json({ error: 'Failed to sync tasks' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { title, status = 'Not Started', priority = 'Low', due_date, notes } = await req.json()

    if (!title || !String(title).trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    const mondayItemId = await createMondayItem({ title, status, priority, dueDate: due_date, notes })

    const { data, error } = await supabase
      .from('company_tasks')
      .insert([
        {
          monday_item_id: String(mondayItemId),
          title,
          status,
          priority,
          due_date: due_date || null,
          notes: notes || null,
          last_synced_at: new Date().toISOString(),
        },
      ])
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error('company-tasks POST error:', err)
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const updates = await req.json()

    const { data: existing, error: fetchError } = await supabase
      .from('company_tasks')
      .select('*')
      .eq('id', id)
      .single<TaskRow>()
    if (fetchError) throw fetchError

    const { data, error } = await supabase
      .from('company_tasks')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error

    if (existing.monday_item_id) {
      await updateMondayItem(existing.monday_item_id, {
        status: updates.status ?? existing.status,
        priority: updates.priority ?? existing.priority,
        dueDate: updates.due_date ?? existing.due_date ?? undefined,
        notes: updates.notes ?? existing.notes ?? undefined,
      })
      await supabase
        .from('company_tasks')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('id', id)
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('company-tasks PATCH error:', err)
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
  }
}
