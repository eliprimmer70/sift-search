'use client'

import { useState, useRef, useEffect } from 'react'

interface SearchResult {
  title: string
  link: string
  snippet: string
  favicon?: string
  siteName?: string
  domain?: string
}

interface ImageResult {
  title: string
  link: string
  thumbnail: string
}

interface KnowledgePanel {
  id: string
  keyword: string
  title: string
  subtitle: string
  description: string
  image: string
  facts: string[]
}

interface AISummary {
  answer: string
  sources: string[]
}

interface WikiKnowledge {
  title: string
  description: string
  image?: string
  facts: Record<string, string>
}

interface FeaturedSnippet {
  title: string
  link: string
  snippet: string
}

const RESULTS_PER_PAGE = 10

export default function Search() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [images, setImages] = useState<ImageResult[]>([])
  const [knowledgePanel, setKnowledgePanel] = useState<KnowledgePanel | null>(null)
  const [aiSummary, setAiSummary] = useState<AISummary | null>(null)
  const [wikiKnowledge, setWikiKnowledge] = useState<WikiKnowledge | null>(null)
  const [relatedQuestions, setRelatedQuestions] = useState<string[]>([])
  const [featuredSnippet, setFeaturedSnippet] = useState<FeaturedSnippet | null>(null)
  const [loading, setLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [selectedTab, setSelectedTab] = useState<'all' | 'images' | 'admin'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
    // Initialize knowledge panels on app load
    const stored = localStorage.getItem('sift_panels')
    if (!stored || JSON.parse(stored).length === 0) {
      const defaultPanels: KnowledgePanel[] = [
        {
          id: '1',
          keyword: 'ariana grande',
          title: 'Ariana Grande',
          subtitle: 'American Singer, Songwriter & Actress',
          description: 'Ariana Grande-Butera is an American singer, songwriter, and actress. Known for her four-octave vocal range, she has received numerous accolades, including two Grammy Awards, an American Music Award, and a BAFTA.',
          image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Ariana_Grande_2018.jpg/440px-Ariana_Grande_2018.jpg',
          facts: ['Born: June 26, 1993', 'Nationality: American', 'Net Worth: $200M+', 'Albums: 7 studio albums', 'Instagram: 380M+ followers']
        }
      ]
      localStorage.setItem('sift_panels', JSON.stringify(defaultPanels))
    }
  }, [])

  const search = async (q: string, page: number = 1) => {
    if (!q.trim()) return
    setQuery(q) // Update the search input
    setLoading(true)
    setShowResults(true)
    setCurrentPage(page)
    setResults([])
    setImages([])
    setKnowledgePanel(null)
    setAiSummary(null)
    setWikiKnowledge(null)
    setRelatedQuestions([])
    setFeaturedSnippet(null)

    const stored = localStorage.getItem('sift_panels')
    const panels: KnowledgePanel[] = stored ? JSON.parse(stored) : []
    const queryLower = q.toLowerCase().trim()
    
    const queryWords = queryLower.split(' ')
    const matchedPanel = panels.find(p => {
      const keyword = p.keyword.toLowerCase()
      return queryLower.includes(keyword) || 
             keyword.split(' ').some(kw => queryWords.some(qw => qw.includes(kw) || kw.includes(qw)))
    })

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&page=${page}`)
      const data = await res.json()
      
      if (data.results) setResults(data.results)
      if (data.images) setImages(data.images)
      if (data.aiSummary) setAiSummary(data.aiSummary)
      if (data.wikiKnowledge) setWikiKnowledge(data.wikiKnowledge)
      if (data.relatedQuestions) setRelatedQuestions(data.relatedQuestions)
      if (data.featuredSnippet) setFeaturedSnippet(data.featuredSnippet)
      if (matchedPanel) setKnowledgePanel(matchedPanel)
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
    setKnowledgePanel(null)
    setAiSummary(null)
    setShowResults(false)
    setCurrentPage(1)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const totalPages = Math.ceil(results.length / RESULTS_PER_PAGE)
  const paginatedResults = results.slice((currentPage - 1) * RESULTS_PER_PAGE, currentPage * RESULTS_PER_PAGE)

  const getPageNumbers = () => {
    const pages: (number | string)[] = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      if (currentPage > 3) pages.push('...')
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
        pages.push(i)
      }
      if (currentPage < totalPages - 2) pages.push('...')
      pages.push(totalPages)
    }
    return pages
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      <div className="max-w-5xl mx-auto px-4">
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
            </div>
          </div>
        ) : (
          <div className="py-8">
            <div className="sticky top-0 bg-black pb-4 mb-6 z-50">
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
                    selectedTab === 'all' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-white'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setSelectedTab('images')}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    selectedTab === 'images' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-white'
                  }`}
                >
                  Images
                </button>
                <button
                  onClick={() => setSelectedTab('admin')}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    selectedTab === 'admin' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-white'
                  }`}
                >
                  Admin
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-zinc-700 border-t-white rounded-full animate-spin"/>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Wiki Knowledge Panel (Google-style info box) */}
                {(wikiKnowledge || knowledgePanel) && selectedTab !== 'images' && selectedTab !== 'admin' && (
                  <div className="border border-zinc-700 rounded-lg overflow-hidden mb-6">
                    <div className="bg-zinc-800 px-4 py-2 border-b border-zinc-700">
                      <span className="text-sm text-zinc-400">
                        {knowledgePanel ? 'People also search for' : 'Wikipedia'}
                      </span>
                    </div>
                    <div className="flex flex-col md:flex-row">
                      {(wikiKnowledge?.image || knowledgePanel?.image) && (
                        <div className="p-4 md:border-r border-zinc-700 flex-shrink-0">
                          <img 
                            src={wikiKnowledge?.image || knowledgePanel?.image} 
                            alt={wikiKnowledge?.title || knowledgePanel?.title}
                            className="w-40 h-40 object-cover rounded-lg"
                          />
                        </div>
                      )}
                      <div className="flex-1 p-4">
                        <h2 className="text-2xl font-normal text-white mb-1">
                          {wikiKnowledge?.title || knowledgePanel?.title}
                        </h2>
                        <p className="text-zinc-400 text-sm mb-3">
                          {knowledgePanel?.subtitle}
                        </p>
                        <p className="text-zinc-300 text-sm leading-relaxed mb-4">
                          {wikiKnowledge?.description || knowledgePanel?.description}
                        </p>
                        {wikiKnowledge?.facts && Object.keys(wikiKnowledge.facts).length > 0 && (
                          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                            {Object.entries(wikiKnowledge.facts).map(([key, value]) => (
                              <div key={key} className="flex">
                                <span className="text-zinc-500">{key}:</span>
                                <span className="text-zinc-300 ml-1">{value}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="mt-4 pt-4 border-t border-zinc-700">
                          <div className="flex gap-4">
                            <button 
                              onClick={() => window.open(`https://en.wikipedia.org/wiki/${encodeURIComponent(wikiKnowledge?.title || knowledgePanel?.title || '')}`, '_blank')}
                              className="text-blue-400 hover:underline text-sm"
                            >
                              Wikipedia
                            </button>
                            <button 
                              onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(wikiKnowledge?.title || knowledgePanel?.title || '')} images`, '_blank')}
                              className="text-blue-400 hover:underline text-sm"
                            >
                              View images
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Featured Snippet */}
                {featuredSnippet && selectedTab !== 'images' && selectedTab !== 'admin' && (
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 mb-6">
                    <p className="text-white text-lg leading-relaxed mb-2">{featuredSnippet.snippet}</p>
                    <button 
                      onClick={() => window.open(featuredSnippet.link, '_blank')}
                      className="text-blue-400 hover:underline text-sm"
                    >
                      {featuredSnippet.title} - Wikipedia
                    </button>
                  </div>
                )}

                {/* AI Summary */}
                {aiSummary && selectedTab !== 'images' && selectedTab !== 'admin' && !featuredSnippet && (
                  <div className="mb-6">
                    <p className="text-zinc-300 leading-relaxed">{aiSummary.answer}</p>
                    {aiSummary.sources.length > 0 && (
                      <div className="mt-2 flex items-center gap-2 text-sm">
                        <span className="text-zinc-500">Sources:</span>
                        {aiSummary.sources.slice(0, 3).map((source, i) => (
                          <button key={i} onClick={() => window.open(`https://${source}`, '_blank')} className="text-blue-400 hover:underline">{source}</button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Related Questions */}
                {relatedQuestions.length > 0 && selectedTab !== 'images' && selectedTab !== 'admin' && (
                  <div className="mb-6">
                    <h3 className="text-white font-medium mb-3">People also ask</h3>
                    <div className="space-y-2">
                      {relatedQuestions.slice(0, 5).map((question, i) => (
                        <button
                          key={i}
                          onClick={() => search(question.replace('What is ', '').replace('?', ''))}
                          className="block w-full text-left p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg hover:bg-zinc-900 transition-colors"
                        >
                          <span className="text-zinc-300">{question}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {selectedTab === 'admin' && <AdminPanel />}
                
                {selectedTab === 'all' && (
                  <div className="space-y-4">
                    <div className="text-zinc-500 text-sm">
                      About {results.length} results
                    </div>
                    {results.length === 0 ? (
                      <p className="text-zinc-500">No results found.</p>
                    ) : (
                      <>
                        {paginatedResults.map((result, i) => (
                          <button
                            key={i}
                            onClick={() => window.open(result.link, '_blank')}
                            className="block w-full text-left group hover:bg-zinc-900/50 p-4 rounded-lg transition-colors -mx-4 px-4"
                          >
                            <div className="flex items-center gap-3 mb-2">
                              {result.favicon && (
                                <img 
                                  src={result.favicon} 
                                  alt="" 
                                  className="w-6 h-6 rounded"
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                                />
                              )}
                              <span className="text-sm text-green-500 truncate max-w-md">{result.domain}</span>
                              <span className="text-zinc-600">›</span>
                              <svg className="w-4 h-4 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </div>
                            <h3 className="text-xl text-blue-500 group-hover:underline mb-1">{result.title}</h3>
                            <p className="text-zinc-400 leading-relaxed text-sm">{result.snippet}</p>
                          </button>
                        ))}
                        
                        {totalPages > 1 && (
                          <div className="flex items-center justify-center gap-2 mt-8 pt-8 border-t border-zinc-800">
                            <button
                              onClick={() => search(query, currentPage - 1)}
                              disabled={currentPage === 1}
                              className="px-4 py-2 text-sm text-zinc-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Previous
                            </button>
                            <div className="flex items-center gap-1">
                              {getPageNumbers().map((page, i) => (
                                typeof page === 'number' ? (
                                  <button
                                    key={i}
                                    onClick={() => search(query, page)}
                                    className={`w-10 h-10 text-sm rounded-full ${
                                      page === currentPage
                                        ? 'bg-zinc-800 text-white'
                                        : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                                    }`}
                                  >
                                    {page}
                                  </button>
                                ) : (
                                  <span key={i} className="px-2 text-zinc-600">...</span>
                                )
                              ))}
                            </div>
                            <button
                              onClick={() => search(query, currentPage + 1)}
                              disabled={currentPage === totalPages}
                              className="px-4 py-2 text-sm text-zinc-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Next
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {selectedTab === 'images' && (
                  <div>
                    <div className="text-zinc-500 text-sm mb-4">
                      About {images.length} images
                    </div>
                    <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {images.map((img, i) => (
                        <a
                          key={i}
                          href={img.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group"
                        >
                          <div className="aspect-square bg-zinc-900 rounded-xl overflow-hidden">
                            <img 
                              src={img.thumbnail} 
                              alt={img.title}
                              className="w-full h-full object-cover group-hover:opacity-80 transition-opacity"
                              loading="lazy"
                            />
                          </div>
                          <p className="text-xs text-zinc-500 mt-2 truncate">{img.title}</p>
                        </a>
                      ))}
                    </div>
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

function AdminPanel() {
  const [keyword, setKeyword] = useState('')
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [description, setDescription] = useState('')
  const [image, setImage] = useState('')
  const [facts, setFacts] = useState('')
  const [imageSearch, setImageSearch] = useState('')
  const [imageResults, setImageResults] = useState<{title: string; thumbnail: string; link: string}[]>([])
  const [searchingImages, setSearchingImages] = useState(false)
  
  const getInitialPanels = (): KnowledgePanel[] => {
    if (typeof window === 'undefined') return []
    const stored = localStorage.getItem('sift_panels')
    const existingPanels: KnowledgePanel[] = stored ? JSON.parse(stored) : []
    
    if (existingPanels.length === 0) {
      const defaultPanels: KnowledgePanel[] = [
        {
          id: 'sift',
          keyword: 'sift',
          title: 'Sift',
          subtitle: 'Web Search Engine',
          description: 'Sift is a modern web search engine that provides fast, accurate search results with AI-powered summaries. Built as an alternative to traditional search engines, Sift offers a clean interface with knowledge panels, image search, and intelligent answers.',
          image: '',
          facts: ['Type: Search Engine', 'Founded: 2024', 'Features: AI Summaries', 'License: Open Source']
        },
        {
          id: 'sift-browser',
          keyword: 'sift browser',
          title: 'Sift Browser',
          subtitle: 'Search Engine & Browser',
          description: 'Sift Browser is a modern search engine with in-browser page preview. It provides fast web searches, AI-powered answers, and keeps you within Sift while browsing.',
          image: '',
          facts: ['Type: Search Engine/Browser', 'Founded: 2024', 'Platform: Web-based', 'Features: Page Preview']
        },
        {
          id: '1',
          keyword: 'ariana grande',
          title: 'Ariana Grande',
          subtitle: 'American Singer, Songwriter & Actress',
          description: 'Ariana Grande-Butera is an American singer, songwriter, and actress. Known for her four-octave vocal range, she has received numerous accolades, including two Grammy Awards, an American Music Award, and a BAFTA.',
          image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Ariana_Grande_2018.jpg/440px-Ariana_Grande_2018.jpg',
          facts: ['Born: June 26, 1993', 'Nationality: American', 'Net Worth: $200M+', 'Albums: 7 studio albums']
        }
      ]
      localStorage.setItem('sift_panels', JSON.stringify(defaultPanels))
      return defaultPanels
    }
    return existingPanels
  }
  
  const [panels, setPanels] = useState<KnowledgePanel[]>(getInitialPanels)

  const savePanel = () => {
    if (!keyword || !title) return
    
    const newPanel: KnowledgePanel = {
      id: Date.now().toString(),
      keyword: keyword.toLowerCase(),
      title,
      subtitle,
      description,
      image,
      facts: facts.split(',').map(f => f.trim()).filter(Boolean)
    }
    
    const updated = [newPanel, ...panels.filter(p => p.keyword !== keyword)]
    setPanels(updated)
    localStorage.setItem('sift_panels', JSON.stringify(updated))
    
    // Reset form
    setKeyword('')
    setTitle('')
    setSubtitle('')
    setDescription('')
    setImage('')
    setFacts('')
  }

  const deletePanel = (id: string) => {
    const updated = panels.filter(p => p.id !== id)
    setPanels(updated)
    localStorage.setItem('sift_panels', JSON.stringify(updated))
  }

  const searchImages = async (q: string) => {
    if (!q.trim()) return
    setSearchingImages(true)
    try {
      const res = await fetch(`/api/images?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setImageResults(data.images || [])
    } catch {}
    setSearchingImages(false)
  }

  const selectImage = (url: string) => {
    setImage(url)
    setImageResults([])
    setImageSearch('')
  }

  return (
    <div className="space-y-6">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
        <h2 className="text-xl font-bold mb-4">Create Knowledge Panel</h2>
        <p className="text-zinc-400 text-sm mb-6">Create info cards that appear when users search for specific keywords.</p>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Keyword (e.g., &quot;Ariana Grande&quot;)</label>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Search keyword"
              className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-3 outline-none focus:border-zinc-500"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Name or title"
              className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-3 outline-none focus:border-zinc-500"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Subtitle</label>
            <input
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="Profession, nationality, etc."
              className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-3 outline-none focus:border-zinc-500"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Image URL</label>
            <div className="space-y-2">
              <input
                type="text"
                value={image}
                onChange={(e) => setImage(e.target.value)}
                placeholder="https://... or search below"
                className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-3 outline-none focus:border-zinc-500"
              />
              {image && (
                <img src={image} alt="Preview" className="w-20 h-20 object-cover rounded-lg" />
              )}
            </div>
          </div>
        </div>
        
        <div className="mb-4">
          <label className="block text-sm text-zinc-400 mb-2">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description..."
            rows={3}
            className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-3 outline-none focus:border-zinc-500 resize-none"
          />
        </div>
        
        <div className="mb-6">
          <label className="block text-sm text-zinc-400 mb-2">Facts (comma separated)</label>
          <input
            type="text"
            value={facts}
            onChange={(e) => setFacts(e.target.value)}
            placeholder="Born 1993, Singer, Actress"
            className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-3 outline-none focus:border-zinc-500"
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm text-zinc-400 mb-2">Search Images</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={imageSearch}
              onChange={(e) => setImageSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchImages(imageSearch)}
              placeholder="Search for images..."
              className="flex-1 bg-black border border-zinc-700 rounded-lg px-4 py-3 outline-none focus:border-zinc-500"
            />
            <button
              onClick={() => searchImages(imageSearch)}
              className="px-4 py-3 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600"
            >
              Search
            </button>
          </div>
          {searchingImages ? (
            <div className="mt-4 flex items-center gap-2">
              <div className="w-5 h-5 border-2 border-zinc-600 border-t-white rounded-full animate-spin"/>
              <span className="text-zinc-400 text-sm">Searching...</span>
            </div>
          ) : imageResults.length > 0 ? (
            <div className="mt-4 grid grid-cols-4 gap-2 max-h-60 overflow-y-auto">
              {imageResults.map((img, i) => (
                <button
                  key={i}
                  onClick={() => selectImage(img.thumbnail)}
                  className={`p-1 rounded-lg border-2 transition-colors ${image === img.thumbnail ? 'border-blue-500' : 'border-transparent hover:border-zinc-600'}`}
                >
                  <img src={img.thumbnail} alt={img.title} className="w-full aspect-square object-cover rounded" />
                </button>
              ))}
            </div>
          ) : null}
        </div>
        
        <button
          onClick={savePanel}
          className="px-6 py-3 bg-white text-black font-semibold rounded-full hover:bg-zinc-200 transition-colors"
        >
          Create Panel
        </button>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Active Panels ({panels.length})</h3>
        {panels.length === 0 ? (
          <p className="text-zinc-500">No panels created yet.</p>
        ) : (
          panels.map((panel) => (
            <div key={panel.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex gap-4">
              {panel.image && (
                <img src={panel.image} alt={panel.title} className="w-20 h-20 object-cover rounded-lg" />
              )}
              <div className="flex-1">
                <div className="flex justify-between">
                  <div>
                    <h4 className="font-semibold">{panel.title}</h4>
                    <p className="text-sm text-zinc-400">Keyword: &quot;{panel.keyword}&quot;</p>
                  </div>
                  <button
                    onClick={() => deletePanel(panel.id)}
                    className="text-red-500 hover:text-red-400 text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
