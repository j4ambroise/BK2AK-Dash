'use client'
import { useEffect, useState, useCallback } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { Photo, Vote, VoteValue } from '@/lib/types'
import AuthGuard from '@/components/AuthGuard'
import { CheckCircle2, Loader2, Plus } from 'lucide-react'

type Tab = 'swipe' | 'gallery' | 'queue' | 'upload' | 'insights' | 'analytics'

const TABS: { id: Tab; emoji: string; label: string }[] = [
  { id: 'swipe',     emoji: '🃏', label: 'Swipe'     },
  { id: 'gallery',   emoji: '🖼️', label: 'Gallery'   },
  { id: 'queue',     emoji: '📋', label: 'Queue'     },
  { id: 'upload',    emoji: '📤', label: 'Upload'    },
  { id: 'insights',  emoji: '🧠', label: 'Insights'  },
  { id: 'analytics', emoji: '📊', label: 'Analytics' },
]

export default function PhotosPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('swipe')
  const [photos, setPhotos] = useState<Photo[]>([])
  const [allVotes, setAllVotes] = useState<Record<string, Vote[]>>({})
  const [myVotes, setMyVotes] = useState<Record<string, VoteValue>>({})
  const [loading, setLoading] = useState(true)
  const userName = user?.email?.split('@')[0] ?? 'staff'

  const loadData = useCallback(async () => {
    const [photosRes, myVotesRes, allVotesRes] = await Promise.all([
      supabase.from('photos').select('*').order('created_at', { ascending: false }),
      supabase.from('votes').select('*').eq('user_name', userName),
      supabase.from('votes').select('*'),
    ])
    setPhotos(photosRes.data ?? [])

    const mv: Record<string, VoteValue> = {}
    for (const v of (myVotesRes.data ?? [])) mv[v.photo_id] = v.vote
    setMyVotes(mv)

    const av: Record<string, Vote[]> = {}
    for (const v of (allVotesRes.data ?? [])) {
      if (!av[v.photo_id]) av[v.photo_id] = []
      av[v.photo_id].push(v)
    }
    setAllVotes(av)
    setLoading(false)
  }, [userName])

  useEffect(() => { loadData() }, [loadData])

  async function castVote(photoId: string, value: VoteValue) {
    const current = myVotes[photoId]
    if (current === value) {
      await supabase.from('votes').delete().eq('photo_id', photoId).eq('user_name', userName)
      setMyVotes(prev => { const n = { ...prev }; delete n[photoId]; return n })
      setAllVotes(prev => ({ ...prev, [photoId]: (prev[photoId] ?? []).filter(v => v.user_name !== userName) }))
    } else {
      await supabase.from('votes').upsert({ photo_id: photoId, user_name: userName, vote: value }, { onConflict: 'photo_id,user_name' })
      setMyVotes(prev => ({ ...prev, [photoId]: value }))
      setAllVotes(prev => ({
        ...prev,
        [photoId]: [...(prev[photoId] ?? []).filter(v => v.user_name !== userName), { id: '', photo_id: photoId, user_name: userName, vote: value, created_at: '' }]
      }))
    }
  }

  function approvalScore(photoId: string): number {
    const votes = allVotes[photoId] ?? []
    if (!votes.length) return 0
    return votes.filter(v => v.vote === 'yes').length / votes.length
  }

  const unvoted = photos.filter(p => !myVotes[p.id])
  const votedCount = photos.length - unvoted.length

  if (loading) {
    return (
      <AuthGuard>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-forest-600 animate-spin" />
        </div>
      </AuthGuard>
    )
  }

  return (
    <AuthGuard>
      <div className="-mx-4 sm:-mx-6 -mt-8">
        {/* Tab bar */}
        <div className="border-b border-stone-200 bg-white sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-4 flex items-center gap-1 overflow-x-auto">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  tab === t.id
                    ? 'border-forest-700 text-forest-700'
                    : 'border-transparent text-stone-400 hover:text-stone-700'
                }`}
              >
                <span>{t.emoji}</span>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 py-8">
          {tab === 'swipe'     && <SwipeTab photos={unvoted} allVotes={allVotes} onVote={castVote} total={photos.length} voted={votedCount} />}
          {tab === 'gallery'   && <GalleryTab photos={photos} myVotes={myVotes} allVotes={allVotes} onVote={castVote} />}
          {tab === 'queue'     && <QueueTab photos={photos} myVotes={myVotes} allVotes={allVotes} approvalScore={approvalScore} />}
          {tab === 'upload'    && <UploadTab onUploaded={loadData} />}
          {tab === 'insights'  && <InsightsTab photos={photos} myVotes={myVotes} allVotes={allVotes} userName={userName} />}
          {tab === 'analytics' && <AnalyticsTab photos={photos} allVotes={allVotes} approvalScore={approvalScore} />}
        </div>
      </div>
    </AuthGuard>
  )
}

// ─── SWIPE TAB ────────────────────────────────────────────────────────────────
function SwipeTab({ photos, allVotes, onVote, total, voted }: {
  photos: Photo[]
  allVotes: Record<string, Vote[]>
  onVote: (id: string, v: VoteValue) => Promise<void>
  total: number
  voted: number
}) {
  const [idx, setIdx] = useState(0)
  const [animDir, setAnimDir] = useState<'left' | 'right' | 'up' | null>(null)
  const [busy, setBusy] = useState(false)

  const sorted = [...photos].sort((a, b) => {
    const aYes = (allVotes[a.id] ?? []).filter(v => v.vote === 'yes').length
    const bYes = (allVotes[b.id] ?? []).filter(v => v.vote === 'yes').length
    return bYes - aYes
  })

  const photo = sorted[idx]

  async function vote(value: VoteValue) {
    if (busy || !photo) return
    setBusy(true)
    setAnimDir(value === 'yes' ? 'right' : value === 'no' ? 'left' : 'up')
    await onVote(photo.id, value)
    setTimeout(() => {
      setIdx(i => i + 1)
      setAnimDir(null)
      setBusy(false)
    }, 280)
  }

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') vote('yes')
      else if (e.key === 'ArrowLeft') vote('no')
      else if (e.key === 'ArrowUp') vote('maybe')
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  const progress = total ? Math.round((voted / total) * 100) : 0

  return (
    <div className="flex flex-col items-center">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-stone-900">Swipe to Vote</h2>
        <p className="text-stone-400 text-sm mt-1">Algorithm sorts by predicted approval ↑</p>
      </div>

      <div className="w-full max-w-sm mb-8">
        <div className="flex justify-between text-xs text-stone-400 mb-1.5">
          <span>{voted} voted</span><span>{total - voted} remaining</span>
        </div>
        <div className="h-1.5 bg-stone-100 rounded-full">
          <div className="h-full bg-forest-600 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {!photo ? (
        <div className="text-center py-16">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <p className="text-stone-800 text-xl font-semibold">You&apos;re all caught up!</p>
          <p className="text-stone-400 mt-2">No more unvoted photos right now.</p>
        </div>
      ) : (
        <>
          <div className="relative w-full max-w-sm aspect-[3/4] mb-8">
            <div className="absolute inset-0 translate-y-3 scale-95 bg-stone-200 rounded-2xl" />
            <div
              className="absolute inset-0 bg-stone-100 rounded-2xl overflow-hidden shadow-2xl"
              style={{
                transform: animDir === 'left' ? 'translateX(-120%) rotate(-15deg)' :
                           animDir === 'right' ? 'translateX(120%) rotate(15deg)' :
                           animDir === 'up' ? 'translateY(-60px) scale(0.9)' : 'none',
                opacity: animDir ? 0 : 1,
                transition: 'transform 0.28s ease-out, opacity 0.28s ease-out',
              }}
            >
              {photo.url ? (
                <Image src={photo.url} alt={photo.filename ?? ''} fill className="object-cover" sizes="400px" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-stone-400 text-sm">No image</div>
              )}
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                {photo.trip_name && <p className="text-xs text-stone-300 mb-0.5">{photo.trip_name}</p>}
                {photo.filename && <p className="text-sm text-white font-medium truncate">{photo.filename}</p>}
                <div className="flex gap-3 mt-2">
                  {(['yes','maybe','no'] as VoteValue[]).map(v => {
                    const count = (allVotes[photo.id] ?? []).filter(x => x.vote === v).length
                    return count > 0 ? (
                      <span key={v} className="text-xs text-stone-200">
                        {v === 'yes' ? '👍' : v === 'maybe' ? '🤔' : '👎'} {count}
                      </span>
                    ) : null
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-4 w-full max-w-sm">
            <button onClick={() => vote('no')} className="flex-1 h-16 bg-red-50 hover:bg-red-100 border border-red-200 rounded-2xl text-3xl transition-colors flex items-center justify-center">👎</button>
            <button onClick={() => vote('maybe')} className="h-16 w-16 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-2xl text-3xl transition-colors flex items-center justify-center">🤔</button>
            <button onClick={() => vote('yes')} className="flex-1 h-16 bg-green-50 hover:bg-green-100 border border-green-200 rounded-2xl text-3xl transition-colors flex items-center justify-center">👍</button>
          </div>

          <p className="text-stone-300 text-xs mt-4">← → arrow keys work · sorted by predicted team approval</p>
        </>
      )}
    </div>
  )
}

// ─── GALLERY TAB ──────────────────────────────────────────────────────────────
function GalleryTab({ photos, myVotes, allVotes, onVote }: {
  photos: Photo[]
  myVotes: Record<string, VoteValue>
  allVotes: Record<string, Vote[]>
  onVote: (id: string, v: VoteValue) => Promise<void>
}) {
  const [tripFilter, setTripFilter] = useState('all')
  const [voteFilter, setVoteFilter] = useState<'all' | 'unvoted' | VoteValue>('all')

  const trips = [...new Set(photos.map(p => p.trip_name).filter(Boolean))] as string[]

  const filtered = photos.filter(p => {
    if (tripFilter !== 'all' && p.trip_name !== tripFilter) return false
    if (voteFilter === 'unvoted') return !myVotes[p.id]
    if (voteFilter === 'yes' || voteFilter === 'maybe' || voteFilter === 'no') return myVotes[p.id] === voteFilter
    return true
  })

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-6">
        <div className="flex gap-1.5 flex-wrap">
          {['all', ...trips].map(t => (
            <button key={t} onClick={() => setTripFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tripFilter === t ? 'bg-forest-700 text-white' : 'bg-white border border-stone-200 text-stone-600 hover:border-forest-300'}`}>
              {t === 'all' ? 'All Trips' : t}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 ml-auto flex-wrap">
          {(['all', 'unvoted', 'yes', 'maybe', 'no'] as const).map(f => (
            <button key={f} onClick={() => setVoteFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${voteFilter === f ? 'bg-forest-700 text-white' : 'bg-white border border-stone-200 text-stone-600 hover:border-forest-300'}`}>
              {f === 'unvoted' ? 'Unvoted' : f === 'all' ? 'All' : f}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {filtered.map(photo => {
          const myVote = myVotes[photo.id]
          const ring = myVote === 'yes' ? 'ring-2 ring-green-500' : myVote === 'maybe' ? 'ring-2 ring-amber-400' : myVote === 'no' ? 'ring-2 ring-red-400' : ''
          return (
            <div key={photo.id} className={`card overflow-hidden ${ring}`}>
              <div className="relative aspect-square bg-stone-100">
                {photo.url ? (
                  <Image src={photo.url} alt={photo.filename ?? ''} fill className="object-cover" sizes="220px" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-stone-400 text-xs">No image</div>
                )}
                {myVote && (
                  <div className={`absolute top-1.5 right-1.5 w-7 h-7 rounded-full flex items-center justify-center text-sm shadow ${myVote === 'yes' ? 'bg-green-500' : myVote === 'maybe' ? 'bg-amber-400' : 'bg-red-400'}`}>
                    {myVote === 'yes' ? '👍' : myVote === 'maybe' ? '🤔' : '👎'}
                  </div>
                )}
              </div>
              <div className="flex gap-1 p-1.5">
                {(['yes','maybe','no'] as VoteValue[]).map(v => (
                  <button key={v} onClick={() => onVote(photo.id, v)}
                    className={`flex-1 py-1.5 rounded-lg text-sm transition-colors ${
                      myVote === v
                        ? (v === 'yes' ? 'bg-green-500 text-white' : v === 'maybe' ? 'bg-amber-400 text-white' : 'bg-red-400 text-white')
                        : 'bg-stone-100 hover:bg-stone-200'
                    }`}>
                    {v === 'yes' ? '👍' : v === 'maybe' ? '🤔' : '👎'}
                  </button>
                ))}
              </div>
              {photo.filename && <p className="px-2 pb-1.5 text-xs text-stone-400 truncate">{photo.filename}</p>}
            </div>
          )
        })}
      </div>
      {filtered.length === 0 && <p className="text-center py-16 text-stone-400">No photos match this filter.</p>}
    </div>
  )
}

// ─── QUEUE TAB ────────────────────────────────────────────────────────────────
function QueueTab({ photos, myVotes, allVotes, approvalScore }: {
  photos: Photo[]
  myVotes: Record<string, VoteValue>
  allVotes: Record<string, Vote[]>
  approvalScore: (id: string) => number
}) {
  const sorted = [...photos].sort((a, b) => approvalScore(b.id) - approvalScore(a.id))

  return (
    <div>
      <p className="text-stone-500 text-sm mb-6">Photos ranked by predicted team approval (% yes votes).</p>
      <div className="space-y-2">
        {sorted.map((photo, idx) => {
          const votes = allVotes[photo.id] ?? []
          const yes = votes.filter(v => v.vote === 'yes').length
          const maybe = votes.filter(v => v.vote === 'maybe').length
          const no = votes.filter(v => v.vote === 'no').length
          const score = votes.length ? Math.round((yes / votes.length) * 100) : 0
          const myVote = myVotes[photo.id]
          return (
            <div key={photo.id} className="card p-3 flex items-center gap-4">
              <span className="text-stone-300 font-bold w-8 text-center flex-shrink-0">#{idx + 1}</span>
              <div className="relative w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden bg-stone-100">
                {photo.url && <Image src={photo.url} alt="" fill className="object-cover" sizes="56px" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-stone-800 truncate">{photo.filename ?? photo.id}</p>
                {photo.trip_name && <p className="text-xs text-stone-400">{photo.trip_name}</p>}
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="flex gap-2 text-sm">
                  <span className="text-green-600">👍 {yes}</span>
                  <span className="text-amber-500">🤔 {maybe}</span>
                  <span className="text-red-500">👎 {no}</span>
                </div>
                <div className={`text-xs font-bold px-2 py-1 rounded-lg ${score >= 60 ? 'bg-green-100 text-green-700' : score >= 30 ? 'bg-amber-100 text-amber-700' : 'bg-stone-100 text-stone-500'}`}>
                  {votes.length ? `${score}%` : '—'}
                </div>
                {myVote && <span className="text-lg">{myVote === 'yes' ? '👍' : myVote === 'maybe' ? '🤔' : '👎'}</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── UPLOAD TAB ───────────────────────────────────────────────────────────────
function UploadTab({ onUploaded }: { onUploaded: () => void }) {
  const [form, setForm] = useState({ url: '', filename: '', trip_name: '', description: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.url.trim()) return
    setSaving(true); setError('')
    const { error: err } = await supabase.from('photos').insert({
      url: form.url.trim(),
      filename: form.filename.trim() || null,
      trip_name: form.trip_name.trim() || null,
      description: form.description.trim() || null,
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    setSaved(true)
    setForm({ url: '', filename: '', trip_name: '', description: '' })
    onUploaded()
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="max-w-lg mx-auto">
      <h2 className="text-xl font-bold text-stone-900 mb-2">Add Photo</h2>
      <p className="text-stone-500 text-sm mb-6">Add a photo by URL to the voting pool.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Photo URL *</label>
          <input className="input" type="url" placeholder="https://..." value={form.url}
            onChange={e => setForm(f => ({ ...f, url: e.target.value }))} required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Filename</label>
            <input className="input" placeholder="IMG_1234.jpg" value={form.filename}
              onChange={e => setForm(f => ({ ...f, filename: e.target.value }))} />
          </div>
          <div>
            <label className="label">Trip Name</label>
            <input className="input" placeholder="Summer 2024" value={form.trip_name}
              onChange={e => setForm(f => ({ ...f, trip_name: e.target.value }))} />
          </div>
        </div>
        <div>
          <label className="label">Description</label>
          <textarea className="input resize-none" rows={3} placeholder="Optional notes..." value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <button type="submit" disabled={saving}
          className="w-full bg-forest-700 text-white font-semibold py-3 rounded-lg hover:bg-forest-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          {saved ? '✓ Added!' : saving ? 'Adding...' : 'Add Photo'}
        </button>
      </form>
    </div>
  )
}

// ─── INSIGHTS TAB ─────────────────────────────────────────────────────────────
function InsightsTab({ photos, myVotes, allVotes, userName }: {
  photos: Photo[]
  myVotes: Record<string, VoteValue>
  allVotes: Record<string, Vote[]>
  userName: string
}) {
  const allVoters = [...new Set(Object.values(allVotes).flatMap(vs => vs.map(v => v.user_name)))]
  const myYes = Object.values(myVotes).filter(v => v === 'yes').length
  const myMaybe = Object.values(myVotes).filter(v => v === 'maybe').length
  const myNo = Object.values(myVotes).filter(v => v === 'no').length
  const myTotal = Object.values(myVotes).length
  const trips = [...new Set(photos.map(p => p.trip_name).filter(Boolean))] as string[]

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-stone-900 mb-4">Your Progress</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Voted', value: myTotal, color: 'text-forest-700' },
            { label: 'Yes 👍', value: myYes, color: 'text-green-600' },
            { label: 'Maybe 🤔', value: myMaybe, color: 'text-amber-500' },
            { label: 'No 👎', value: myNo, color: 'text-red-500' },
          ].map(s => (
            <div key={s.label} className="card p-4 text-center">
              <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-stone-500 text-sm mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-stone-900 mb-4">Team Voting Progress</h3>
        <div className="space-y-3">
          {allVoters.sort().map(voter => {
            const voterVotes = Object.values(allVotes).flat().filter(v => v.user_name === voter)
            const vYes = voterVotes.filter(v => v.vote === 'yes').length
            const vTotal = voterVotes.length
            const pct = photos.length ? Math.round((vTotal / photos.length) * 100) : 0
            return (
              <div key={voter} className="card p-3 flex items-center gap-4">
                <div className="w-8 h-8 bg-forest-700 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                  {voter[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-stone-800">{voter}{voter === userName ? ' (you)' : ''}</p>
                  <div className="h-1.5 bg-stone-100 rounded-full mt-1.5">
                    <div className="h-full bg-forest-500 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <span className="text-xs text-stone-400 flex-shrink-0">{vTotal}/{photos.length} · 👍 {vYes}</span>
              </div>
            )
          })}
        </div>
      </div>

      {trips.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-stone-900 mb-4">Photos by Trip</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {trips.map(trip => (
              <div key={trip} className="card p-4">
                <p className="text-stone-800 font-medium truncate">{trip}</p>
                <p className="text-stone-400 text-sm mt-1">{photos.filter(p => p.trip_name === trip).length} photos</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── ANALYTICS TAB ────────────────────────────────────────────────────────────
function AnalyticsTab({ photos, allVotes, approvalScore }: {
  photos: Photo[]
  allVotes: Record<string, Vote[]>
  approvalScore: (id: string) => number
}) {
  const top = [...photos]
    .filter(p => (allVotes[p.id] ?? []).length > 0)
    .sort((a, b) => approvalScore(b.id) - approvalScore(a.id))
    .slice(0, 30)

  const totalVotes = Object.values(allVotes).flat().length
  const totalYes = Object.values(allVotes).flat().filter(v => v.vote === 'yes').length

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Photos', value: photos.length },
          { label: 'Total Votes', value: totalVotes },
          { label: 'Yes Votes', value: totalYes },
          { label: 'Approval Rate', value: totalVotes ? `${Math.round((totalYes / totalVotes) * 100)}%` : '—' },
        ].map(s => (
          <div key={s.label} className="card p-4 text-center">
            <p className="text-3xl font-bold text-forest-700">{s.value}</p>
            <p className="text-stone-500 text-sm mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div>
        <h3 className="text-lg font-semibold text-stone-900 mb-4">Top Performing Photos</h3>
        <div className="space-y-2">
          {top.map((photo, idx) => {
            const votes = allVotes[photo.id] ?? []
            const yes = votes.filter(v => v.vote === 'yes').length
            const score = Math.round(approvalScore(photo.id) * 100)
            return (
              <div key={photo.id} className="card p-3 flex items-center gap-4">
                <span className="text-stone-300 font-bold w-8 text-center text-sm flex-shrink-0">#{idx + 1}</span>
                <div className="relative w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-stone-100">
                  {photo.url && <Image src={photo.url} alt="" fill className="object-cover" sizes="48px" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-stone-800 truncate">{photo.filename ?? photo.id}</p>
                  {photo.trip_name && <p className="text-xs text-stone-400">{photo.trip_name}</p>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-green-600 text-sm">👍 {yes}</span>
                  <div className="w-16 h-1.5 bg-stone-100 rounded-full">
                    <div className="h-full bg-forest-500 rounded-full" style={{ width: `${score}%` }} />
                  </div>
                  <span className="text-xs text-stone-400 w-8 text-right">{score}%</span>
                </div>
              </div>
            )
          })}
          {top.length === 0 && <p className="text-stone-400 text-center py-8">No votes yet.</p>}
        </div>
      </div>
    </div>
  )
}
