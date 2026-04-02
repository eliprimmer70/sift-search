'use client'

import { useState, useRef, useEffect } from 'react'

interface SearchResult {
  title: string
  link: string
  snippet: string
}

interface ImageResult {
  title: string
  link: string
  thumbnail: string
}

interface AISummary {
  answer: string
  sources: string[]
}

export default function Search() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [images, setImages] = useState<ImageResult[]>([])
  const [aiSummary, setAiSummary] = useState<AISummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [selectedTab, setSelectedTab] = useState<'all' | 'images'>('all')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [])

  const search = async (q: string) => {
    if (!q.trim()) return
    setLoading(true)
    setShowResults(true)
    setResults([])
    setImages([])
    setAiSummary(null)

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      
      if (data.results) {
        setResults(data.results)
      }
      if (data.images) {
        setImages(data.images)
      }
      if (data.aiSummary) {
        setAiSummary(data.aiSummary)
      }
    } catch (err) {
      console.error(err)
    }

    setLoading(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      search(query)
    }
  }

  const clearSearch = () => {
    setQuery('')
    setResults([])
    setImages([])
    setAiSummary(null)
    setShowResults(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      <div className="max-w-4xl mx-auto px-4">
        {!showResults ? (
          <div className="flex flex-col items-center justify-center min-h-screen">
            <h1 className="text-6xl font-bold mb-2 tracking-tight">Sift</h1>
            <p className="text-zinc-500 mb-12 text-lg">Search with clarity</p>
            
            <div className="w-full max-w-2xl relative">
              <div className="relative flex items-center bg-zinc-900 rounded-full border border-zinc-800 focus-within:border-zinc-700 transition-colors">
                <svg className="w-5 h-5 text-zinc-500 ml-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8" strokeWidth="2"/>
                  <path strokeWidth="2" d="m21 21-4.35-4.35"/>
                </svg>
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search the web..."
                  className="w-full bg-transparent py-4 px-4 text-lg outline-none placeholder:text-zinc-600"
                />
                {query && (
                  <button 
                    onClick={clearSearch}
                    className="mr-4 text-zinc-500 hover:text-zinc-300"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                )}
              </div>
              
              <button 
                onClick={() => search(query)}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-6 py-2 bg-white text-black font-medium rounded-full hover:bg-zinc-200 transition-colors"
              >
                Search
              </button>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => search('site:youtube.com')}
                className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-full text-sm text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
              >
                YouTube
              </button>
              <button
                onClick={() => search('site:wikipedia.org')}
                className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-full text-sm text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
              >
                Wikipedia
              </button>
              <button
                onClick={() => search('site:github.com')}
                className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-full text-sm text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
              >
                GitHub
              </button>
              <button
                onClick={() => search('site:amazon.com')}
                className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-full text-sm text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
              >
                Amazon
              </button>
            </div>
          </div>
        ) : (
          <div className="py-8">
            <div className="sticky top-0 bg-black pb-4 mb-6">
              <div className="flex items-center justify-between mb-4">
                <button onClick={clearSearch} className="text-2xl font-bold hover:text-zinc-300 transition-colors">Sift</button>
                <div className="flex items-center gap-3">
                  <div className="relative w-full max-w-xl">
                    <svg className="w-4 h-4 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <circle cx="11" cy="11" r="8" strokeWidth="2"/>
                      <path strokeWidth="2" d="m21 21-4.35-4.35"/>
                    </svg>
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="w-full bg-zinc-900 py-3 pl-11 pr-12 rounded-full border border-zinc-800 outline-none focus:border-zinc-700 text-sm"
                      placeholder="Search..."
                    />
                    {query && (
                      <button 
                        onClick={clearSearch}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                      </button>
                    )}
                  </div>
                  <button 
                    onClick={() => search(query)}
                    className="px-5 py-2 bg-white text-black text-sm font-medium rounded-full hover:bg-zinc-200 transition-colors"
                  >
                    Search
                  </button>
                </div>
              </div>

              <div className="flex gap-1">
                <button
                  onClick={() => setSelectedTab('all')}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    selectedTab === 'all' 
                      ? 'bg-zinc-800 text-white' 
                      : 'text-zinc-500 hover:text-white'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setSelectedTab('images')}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    selectedTab === 'images' 
                      ? 'bg-zinc-800 text-white' 
                      : 'text-zinc-500 hover:text-white'
                  }`}
                >
                  Images
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-zinc-700 border-t-white rounded-full animate-spin"/>
              </div>
            ) : (
              <div className="space-y-6">
                {aiSummary && (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                        </svg>
                      </div>
                      <span className="font-semibold">AI Summary</span>
                    </div>
                    <p className="text-zinc-300 text-lg leading-relaxed mb-4">{aiSummary.answer}</p>
                    {aiSummary.sources.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {aiSummary.sources.slice(0, 3).map((source, i) => (
                          <span key={i} className="text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded">{source}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {selectedTab === 'all' && (
                  <div className="space-y-4">
                    <div className="text-zinc-500 text-sm">
                      About {results.length} results
                    </div>
                    {results.length === 0 ? (
                      <p className="text-zinc-500">No results found. Try a different search.</p>
                    ) : (
                      results.map((result, i) => (
                        <a
                          key={i}
                          href={result.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block group"
                        >
                          <div className="text-sm text-zinc-500 mb-1 truncate">{result.link}</div>
                          <h3 className="text-lg text-blue-500 group-hover:underline mb-1">{result.title}</h3>
                          <p className="text-zinc-400 leading-relaxed">{result.snippet}</p>
                        </a>
                      ))
                    )}
                  </div>
                )}

                {selectedTab === 'images' && (
                  <div>
                    <div className="text-zinc-500 text-sm mb-4">
                      About {images.length} images
                    </div>
                    {images.length === 0 ? (
                      <p className="text-zinc-500">No images found.</p>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {images.map((img, i) => (
                          <a
                            key={i}
                            href={img.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group"
                          >
                            <div className="aspect-square bg-zinc-900 rounded-lg overflow-hidden mb-2">
                              <img 
                                src={img.thumbnail} 
                                alt={img.title}
                                className="w-full h-full object-cover group-hover:opacity-80 transition-opacity"
                                loading="lazy"
                              />
                            </div>
                            <p className="text-sm text-zinc-400 truncate">{img.title}</p>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
