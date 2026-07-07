const MONDAY_API_URL = 'https://api.monday.com/v2';

// Real column IDs from the BK2AK board (id 18420807888) — confirmed via board schema.
export const MONDAY_COLUMNS = {
  owner: 'project_owner',   // people
  status: 'project_status', // status: Not Started | Working on it | Done | Stuck
  dueDate: 'date',           // date
  priority: 'priority',      // status: Low | Medium | High
  notes: 'text',             // long text
};

async function mondayRequest(query, variables = {}) {
  const res = await fetch(MONDAY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: process.env.MONDAY_API_TOKEN,
      'API-Version': '2024-10',
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json();
  if (json.errors) {
    throw new Error(`Monday API error: ${JSON.stringify(json.errors)}`);
  }
  return json.data;
}

export async function fetchMondayItems() {
  const boardId = process.env.MONDAY_BOARD_ID;
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
  `;

  const data = await mondayRequest(query, { boardId: [boardId] });
  const items = data.boards?.[0]?.items_page?.items || [];

  return items.map((item) => {
    const cols = Object.fromEntries(item.column_values.map((c) => [c.id, c.text]));
    return {
      monday_item_id: item.id,
      title: item.name,
      status: cols[MONDAY_COLUMNS.status] || 'Not Started',
      priority: cols[MONDAY_COLUMNS.priority] || 'Low',
      assignee: cols[MONDAY_COLUMNS.owner] || null,
      due_date: cols[MONDAY_COLUMNS.dueDate] || null,
      notes: cols[MONDAY_COLUMNS.notes] || null,
      monday_updated_at: item.updated_at,
    };
  });
}

export async function createMondayItem({ title, status, priority, dueDate, notes }) {
  const boardId = process.env.MONDAY_BOARD_ID;
  const columnValues = {
    [MONDAY_COLUMNS.status]: { label: status || 'Not Started' },
    [MONDAY_COLUMNS.priority]: { label: priority || 'Low' },
    ...(dueDate ? { [MONDAY_COLUMNS.dueDate]: { date: dueDate } } : {}),
    ...(notes ? { [MONDAY_COLUMNS.notes]: notes } : {}),
  };

  const query = `
    mutation ($boardId: ID!, $itemName: String!, $columnValues: JSON!) {
      create_item(board_id: $boardId, item_name: $itemName, column_values: $columnValues) {
        id
      }
    }
  `;

  const data = await mondayRequest(query, {
    boardId,
    itemName: title,
    columnValues: JSON.stringify(columnValues),
  });

  return data.create_item.id;
}

export async function updateMondayItem(itemId, { status, priority, dueDate, notes }) {
  const boardId = process.env.MONDAY_BOARD_ID;
  const columnValues = {
    ...(status ? { [MONDAY_COLUMNS.status]: { label: status } } : {}),
    ...(priority ? { [MONDAY_COLUMNS.priority]: { label: priority } } : {}),
    ...(dueDate ? { [MONDAY_COLUMNS.dueDate]: { date: dueDate } } : {}),
    ...(notes !== undefined ? { [MONDAY_COLUMNS.notes]: notes } : {}),
  };

  const query = `
    mutation ($boardId: ID!, $itemId: ID!, $columnValues: JSON!) {
      change_multiple_column_values(board_id: $boardId, item_id: $itemId, column_values: $columnValues) {
        id
      }
    }
  `;

  await mondayRequest(query, {
    boardId,
    itemId,
    columnValues: JSON.stringify(columnValues),
  });
}
