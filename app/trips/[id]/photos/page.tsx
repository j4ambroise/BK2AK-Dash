'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { Photo } from '@/lib/types'
import AuthGuard from '@/components/AuthGuard'
import { ArrowLeft, Upload, Loader2, X, ImageIcon } from 'lucide-react'

export default function TripPhotosPage() {
  const { id } = useParams<{ id: string }>()
  const [tripName, setTripName] = useState('')
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const [tripRes, photosRes] = await Promise.all([
      supabase.from('trips').select('name').eq('id', id).single(),
      supabase.from('photos').select('*').eq('trip_id', id).order('created_at', { ascending: false }),
    ])
    setTripName(tripRes.data?.name ?? '')
    setPhotos(photosRes.data ?? [])
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')

    // Upload to Supabase Storage
    const ext = file.name.split('.').pop()
    const filename = `${id}/${Date.now()}.${ext}`
    const { error: uploadErr } = await supabase.storage
      .from('photos')
      .upload(filename, file, { upsert: false })

    if (uploadErr) {
      setError(uploadErr.message)
      setUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('photos').getPublicUrl(filename)

    const { data, error: insertErr } = await supabase.from('photos').insert({
      url: publicUrl,
      filename: file.name,
      trip_id: id,
      trip_name: tripName,
      description: description.trim() || null,
    }).select().single()

    setUploading(false)
    if (insertErr) { setError(insertErr.message); return }
    if (data) setPhotos(prev => [data, ...prev])
    setDescription('')
    // Reset file input
    e.target.value = ''
  }

  async function deletePhoto(photo: Photo) {
    if (!confirm('Delete this photo?')) return
    // Remove from storage
    const path = photo.url.split('/photos/')[1]
    if (path) await supabase.storage.from('photos').remove([path])
    await supabase.from('photos').delete().eq('id', photo.id)
    setPhotos(prev => prev.filter(p => p.id !== photo.id))
  }

  return (
    <AuthGuard>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Link href={`/trips`} className="btn-ghost flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" /> Trips
            </Link>
            <div>
              <h1 className="text-xl font-bold text-stone-900">Photos</h1>
              <p className="text-sm text-stone-500">{tripName}</p>
            </div>
          </div>
        </div>

        {/* Upload area */}
        <div className="card p-5 mb-6">
          <h2 className="font-semibold text-stone-800 mb-4">Upload Photo</h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="label">Description (optional)</label>
              <input
                className="input"
                placeholder="Campfire dinner, Day 3 hike…"
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <label className={`btn-primary flex items-center gap-2 cursor-pointer ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploading ? 'Uploading…' : 'Choose File'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
              </label>
            </div>
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mt-3">{error}</p>}
        </div>

        {/* Photo grid */}
        {loading ? (
          <div className="text-center py-16 text-stone-400">Loading photos...</div>
        ) : photos.length === 0 ? (
          <div className="text-center py-16 text-stone-400">
            <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No photos yet — upload the first one above.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {photos.map(photo => (
              <div key={photo.id} className="card overflow-hidden group">
                <div className="relative aspect-square bg-stone-100">
                  <Image
                    src={photo.url}
                    alt={photo.description ?? photo.filename ?? ''}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  />
                  <button
                    onClick={() => deletePhoto(photo)}
                    className="absolute top-1.5 right-1.5 w-7 h-7 bg-black/50 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {photo.description && (
                  <p className="px-2 py-1.5 text-xs text-stone-500 truncate">{photo.description}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AuthGuard>
  )
}
