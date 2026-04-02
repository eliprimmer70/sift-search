import { NextResponse } from 'next/server'

const FALLBACK_RESULTS = [
  { name: 'Google', domain: 'google.com', searchParam: 'q' },
  { name: 'YouTube', domain: 'youtube.com', searchParam: 'search_query' },
  { name: 'Reddit', domain: 'reddit.com', searchParam: 'q' },
  { name: 'Twitter', domain: 'twitter.com', searchParam: 'q' },
  { name: 'Wikipedia', domain: 'wikipedia.org', searchParam: 'search' },
  { name: 'GitHub', domain: 'github.com', searchParam: 'q' },
  { name: 'Amazon', domain: 'amazon.com', searchParam: 'k' },
  { name: 'CNN', domain: 'cnn.com', searchParam: 'q' },
  { name: 'BBC', domain: 'bbc.com', searchParam: 'q' },
  { name: 'Stack Overflow', domain: 'stackoverflow.com', searchParam: 'q' },
]

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''
    const page = searchParams.get('page') || '1'

    if (!query.trim()) {
      return NextResponse.json({ error: 'Query required' }, { status: 400 })
    }

    const results = FALLBACK_RESULTS.map((source, i) => ({
      title: `${source.name} - ${query}`,
      link: `https://www.${source.domain}/search?${source.searchParam}=${encodeURIComponent(query)}`,
      snippet: `Search ${query} on ${source.name}`,
      favicon: `https://www.google.com/s2/favicons?domain=${source.domain}&sz=32`,
      domain: `www.${source.domain}`,
      icon: 'web',
      position: i + 1
    }))

    const images = Array.from({ length: 12 }, (_, i) => ({
      title: `${query} image ${i + 1}`,
      link: `https://www.google.com/search?q=${encodeURIComponent(query)} images`,
      thumbnail: `https://picsum.photos/seed/${query.replace(/\s+/g, '')}${i}/400/400`
    }))

    const aiSummary = {
      answer: `Here are search results for "${query}". Click any result below to visit that website and find more information.`,
      sources: ['Google', 'Bing', 'DuckDuckGo']
    }

    const wikiKnowledge = {
      title: query,
      description: `Search results for "${query}" across multiple platforms.`,
      facts: {}
    }

    const featuredSnippet = {
      title: `Results for "${query}"`,
      link: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
      snippet: `Showing results for ${query}. Click a link below to visit that website.`
    }

    const relatedQuestions = [
      `What is ${query}?`,
      `How to use ${query}`,
      `${query} tutorial`,
      `${query} examples`,
      `${query} definition`
    ]

    return NextResponse.json({
      results,
      images,
      aiSummary,
      wikiKnowledge,
      featuredSnippet,
      relatedQuestions,
      knowledgePanel: null
    })
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json({
      results: [{
        title: 'Google Search',
        link: `https://www.google.com/search?q=${encodeURIComponent(request.url.split('?q=')[1] || '')}`,
        snippet: 'Click to search on Google'
      }],
      images: [],
      aiSummary: null,
      knowledgePanel: null
    })
  }
}
