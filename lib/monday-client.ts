const MONDAY_API_URL = 'https://api.monday.com/v2'

// Real column IDs from the BK2AK board (id 18420807888) — confirmed via board schema.
export const MONDAY_COLUMNS = {
  owner: 'project_owner',
  status: 'project_status',
  dueDate: 'date',
  priority: 'priority',
  notes: 'text',
} as const

export interface MondayTask {
  monday_item_id: string
  title: string
  status: string
  priority: string
  assignee: string | null
  due_date: string | null
  notes: string | null
  monday_updated_at: string
}

interface MondayColumnValue {
  id: string
  text: string | null
}

interface MondayItem {
  id: string
  name: string
  updated_at: string
  column_values: MondayColumnValue[]
}

async function mondayRequest<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(MONDAY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: process.env.MONDAY_API_TOKEN!,
      'API-Version': '2024-10',
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(10000),
  })

  const json = await res.json()
  if (json.errors) {
    throw new Error(`Monday API error: ${JSON.stringify(json.errors)}`)
  }
  return json.data as T
}

export async function fetchMondayItems(): Promise<MondayTask[]> {
  const boardId = process.env.MONDAY_BOARD_ID

  const query = `
    query ($boardId: [ID!]) {
      boards(ids: $boardId) {
        items_page(limit: 100) {
          items {
            id
            name
            updated_at
            column_values(ids: ["${MONDAY_COLUMNS.owner}", "${MONDAY_COLUMNS.status}", "${MONDAY_COLUMNS.dueDate}", "${MONDAY_COLUMNS.priority}", "${MONDAY_COLUMNS.notes}"]) {
              id
              text
            }
          }
        }
      }
    }
  `

  const data = await mondayRequest<{ boards: { items_page: { items: MondayItem[] } }[] }>(query, {
    boardId: [boardId],
  })
  const items = data.boards?.[0]?.items_page?.items ?? []

  return items.map((item) => {
    const cols = Object.fromEntries(item.column_values.map((c) => [c.id, c.text]))
    return {
      monday_item_id: item.id,
      title: item.name,
      status: cols[MONDAY_COLUMNS.status] || 'Not Started',
      priority: cols[MONDAY_COLUMNS.priority] || 'Low',
      assignee: cols[MONDAY_COLUMNS.owner] || null,
      due_date: cols[MONDAY_COLUMNS.dueDate] || null,
      notes: cols[MONDAY_COLUMNS.notes] || null,
      monday_updated_at: item.updated_at,
    }
  })
}

interface TaskInput {
  title?: string
  status?: string
  priority?: string
  dueDate?: string
  notes?: string
}

export async function createMondayItem({ title, status, priority, dueDate, notes }: TaskInput): Promise<string> {
  const boardId = process.env.MONDAY_BOARD_ID
  const columnValues: Record<string, unknown> = {
    [MONDAY_COLUMNS.status]: { label: status || 'Not Started' },
    [MONDAY_COLUMNS.priority]: { label: priority || 'Low' },
    ...(dueDate ? { [MONDAY_COLUMNS.dueDate]: { date: dueDate } } : {}),
    ...(notes ? { [MONDAY_COLUMNS.notes]: notes } : {}),
  }

  const query = `
    mutation ($boardId: ID!, $itemName: String!, $columnValues: JSON!) {
      create_item(board_id: $boardId, item_name: $itemName, column_values: $columnValues) {
        id
      }
    }
  `

  const data = await mondayRequest<{ create_item: { id: string } }>(query, {
    boardId,
    itemName: title,
    columnValues: JSON.stringify(columnValues),
  })

  return data.create_item.id
}

export async function updateMondayItem(itemId: string, { status, priority, dueDate, notes }: TaskInput): Promise<void> {
  const boardId = process.env.MONDAY_BOARD_ID
  const columnValues: Record<string, unknown> = {
    ...(status ? { [MONDAY_COLUMNS.status]: { label: status } } : {}),
    ...(priority ? { [MONDAY_COLUMNS.priority]: { label: priority } } : {}),
    ...(dueDate ? { [MONDAY_COLUMNS.dueDate]: { date: dueDate } } : {}),
    ...(notes !== undefined ? { [MONDAY_COLUMNS.notes]: notes } : {}),
  }

  const query = `
    mutation ($boardId: ID!, $itemId: ID!, $columnValues: JSON!) {
      change_multiple_column_values(board_id: $boardId, item_id: $itemId, column_values: $columnValues) {
        id
      }
    }
  `

  await mondayRequest(query, {
    boardId,
    itemId,
    columnValues: JSON.stringify(columnValues),
  })
}
