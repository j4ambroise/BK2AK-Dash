import { useState, useEffect, useCallback } from 'react';
import { listDocs, createDoc, updateDoc, deleteDoc, DEFAULT_DOC_CATEGORIES } from '../lib/company-docs';

const CATEGORY_LABELS = {
  marketing: 'Marketing',
  ops: 'Ops',
  fundraising: 'Fundraising',
  recruitment: 'Recruitment',
  uncategorized: 'Uncategorized',
};

export default function CompanyDocsTab() {
  const [docs, setDocs] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_DOC_CATEGORIES);
  const [activeCategory, setActiveCategory] = useState(null); // null = all
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(null); // { title, content, category }
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listDocs(activeCategory ? { category: activeCategory } : {});
      setDocs(data);
    } catch (e) {
      setError('Could not load docs. Try again in a moment.');
    } finally {
      setLoading(false);
    }
  }, [activeCategory]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function openDoc(doc) {
    setSelectedId(doc.id);
    setDraft({ title: doc.title, content: doc.content, category: doc.category });
  }

  function startNewDoc() {
    setSelectedId('new');
    setDraft({ title: '', content: '', category: activeCategory || 'uncategorized' });
  }

  async function saveDraft() {
    if (!draft.title.trim()) {
      setError('Give the doc a title before saving.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (selectedId === 'new') {
        const created = await createDoc({ ...draft });
        setSelectedId(created.id);
      } else {
        await updateDoc(selectedId, { ...draft });
      }
      await refresh();
    } catch (e) {
      setError('Save failed. Your edits are still here — try saving again.');
    } finally {
      setSaving(false);
    }
  }

  async function removeDoc(id) {
    if (!window.confirm('Delete this doc? This can\u2019t be undone.')) return;
    try {
      await deleteDoc(id);
      if (selectedId === id) {
        setSelectedId(null);
        setDraft(null);
      }
      await refresh();
    } catch (e) {
      setError('Delete failed. Try again.');
    }
  }

  function confirmNewCategory() {
    const name = newCategoryName.trim().toLowerCase().replace(/\s+/g, '-');
    if (!name) return;
    if (!categories.includes(name)) {
      setCategories((prev) => [...prev, name]);
    }
    setDraft((d) => ({ ...d, category: name }));
    setNewCategoryName('');
    setAddingCategory(false);
  }

  return (
    <div className="flex h-full min-h-[600px] gap-4">
      {/* Category rail */}
      <div className="w-44 shrink-0 border-r border-neutral-800 pr-3">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Categories
        </div>
        <button
          onClick={() => setActiveCategory(null)}
          className={`block w-full rounded px-2 py-1.5 text-left text-sm ${
            activeCategory === null ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:bg-neutral-900'
          }`}
        >
          All docs
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`block w-full rounded px-2 py-1.5 text-left text-sm ${
              activeCategory === cat ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:bg-neutral-900'
            }`}
          >
            {CATEGORY_LABELS[cat] || cat}
          </button>
        ))}
      </div>

      {/* Doc list */}
      <div className="w-72 shrink-0 border-r border-neutral-800 pr-3">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Docs
          </span>
          <button
            onClick={startNewDoc}
            className="rounded bg-white px-2 py-1 text-xs font-medium text-black hover:bg-neutral-200"
          >
            + New
          </button>
        </div>

        {loading && <div className="text-sm text-neutral-500">Loading…</div>}
        {!loading && docs.length === 0 && (
          <div className="text-sm text-neutral-500">
            Nothing here yet. Start a doc to plan the next move.
          </div>
        )}

        <ul className="space-y-1">
          {docs.map((doc) => (
            <li key={doc.id}>
              <button
                onClick={() => openDoc(doc)}
                className={`group flex w-full items-center justify-between rounded px-2 py-2 text-left text-sm ${
                  selectedId === doc.id ? 'bg-neutral-800 text-white' : 'text-neutral-300 hover:bg-neutral-900'
                }`}
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{doc.title}</div>
                  <div className="truncate text-xs text-neutral-500">
                    {CATEGORY_LABELS[doc.category] || doc.category} · {new Date(doc.updated_at).toLocaleDateString()}
                  </div>
                </div>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeDoc(doc.id);
                  }}
                  className="ml-2 shrink-0 text-neutral-600 opacity-0 group-hover:opacity-100 hover:text-red-400"
                >
                  Delete
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Editor */}
      <div className="flex-1 pl-1">
        {!draft && (
          <div className="flex h-full items-center justify-center text-sm text-neutral-500">
            Select a doc, or start a new one.
          </div>
        )}

        {draft && (
          <div className="flex h-full flex-col gap-3">
            <input
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="Doc title"
              className="w-full rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-lg font-semibold text-white outline-none focus:border-neutral-500"
            />

            <div className="flex flex-wrap items-center gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setDraft((d) => ({ ...d, category: cat }))}
                  className={`rounded-full px-3 py-1 text-xs ${
                    draft.category === cat
                      ? 'bg-white text-black'
                      : 'border border-neutral-700 text-neutral-400 hover:border-neutral-500'
                  }`}
                >
                  {CATEGORY_LABELS[cat] || cat}
                </button>
              ))}

              {!addingCategory && (
                <button
                  onClick={() => setAddingCategory(true)}
                  className="rounded-full border border-dashed border-neutral-700 px-3 py-1 text-xs text-neutral-500 hover:border-neutral-500 hover:text-neutral-300"
                >
                  + Add category
                </button>
              )}
              {addingCategory && (
                <div className="flex items-center gap-1">
                  <input
                    autoFocus
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && confirmNewCategory()}
                    placeholder="category-name"
                    className="w-32 rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs text-white outline-none"
                  />
                  <button
                    onClick={confirmNewCategory}
                    className="rounded bg-white px-2 py-1 text-xs font-medium text-black"
                  >
                    Add
                  </button>
                </div>
              )}
            </div>

            <textarea
              value={draft.content}
              onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))}
              placeholder="Write the plan, strategy, or notes here…"
              className="min-h-[380px] flex-1 resize-none rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-200 outline-none focus:border-neutral-500"
            />

            {error && <div className="text-sm text-red-400">{error}</div>}

            <div className="flex items-center gap-2">
              <button
                onClick={saveDraft}
                disabled={saving}
                className="rounded bg-white px-4 py-2 text-sm font-medium text-black hover:bg-neutral-200 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              {selectedId !== 'new' && (
                <button
                  onClick={() => {
                    setSelectedId(null);
                    setDraft(null);
                  }}
                  className="rounded px-4 py-2 text-sm text-neutral-400 hover:text-white"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
