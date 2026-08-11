'use client'

import { useState } from 'react'
import CompanyDocsTab from '@/components/CompanyDocsTab'
import CompanyTasksTab from '@/components/CompanyTasksTab'
import CompanyGrantsTab from '@/components/CompanyGrantsTab'

type SubTab = 'docs' | 'tasks' | 'grants' | 'slack'

export default function CompanyPage() {
  const [subTab, setSubTab] = useState<SubTab>('docs')

  const tabs: { id: SubTab; label: string; disabled?: boolean }[] = [
    { id: 'docs', label: 'Docs' },
    { id: 'tasks', label: 'Tasks' },
    { id: 'grants', label: 'Grants' },
    { id: 'slack', label: 'Slack', disabled: true }, // enabled once bot token is wired up
  ]

  return (
    <div>
      <div className="mb-6 flex items-center gap-1 border-b border-neutral-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            disabled={tab.disabled}
            onClick={() => setSubTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              subTab === tab.id
                ? 'border-b-2 border-neutral-900 text-neutral-900'
                : tab.disabled
                ? 'cursor-not-allowed text-neutral-400'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            {tab.label}
            {tab.disabled && <span className="ml-1.5 text-xs text-neutral-600">(soon)</span>}
          </button>
        ))}
      </div>

      {subTab === 'docs' && <CompanyDocsTab />}
      {subTab === 'tasks' && <CompanyTasksTab />}
      {subTab === 'grants' && <CompanyGrantsTab />}
      {subTab === 'slack' && (
        <div className="text-sm text-neutral-500">Slack feed coming once the bot token is set up.</div>
      )}
    </div>
  )
}
