import { NextResponse } from 'next/server'

const cache = new Map<string, { data: unknown; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000

const KNOWLEDGE_PANELS = [
  {
    id: 'sift',
    keyword: 'sift',
    title: 'Sift',
    subtitle: 'Web Search Engine',
    description: 'Sift is a modern web search engine that provides fast, accurate search results with AI-powered summaries. Built as an alternative to traditional search engines, Sift offers a clean interface with knowledge panels, image search, and intelligent answers.',
    image: '',
    facts: ['Type: Search Engine', 'Founded: 2024', 'Features: AI Summaries, Knowledge Panels, Image Search']
  }
]

const ADULT_KEYWORDS = ['sex', 'porn', 'xxx', 'nude', 'naked', 'adult', 'erotic', 'fuck', 'shit', 'piss', 'cunt', 'dick', 'cock', 'pussy', 'ass', 'boob', 'nipple']

function isAdultQuery(query: string): boolean {
  const lower = query.toLowerCase()
  return ADULT_KEYWORDS.some(kw => lower.includes(kw))
}

function parseQueryForRichResults(query: string) {
  const q = query.toLowerCase().trim()
  
  if (q === 'time' || q.match(/^(what('s| is) the )?time$/i)) {
    const now = new Date()
    return { type: 'time', data: { time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } }
  }
  
  if (q === 'date' || q === 'today' || q.match(/^(what('s| is) the )?date$/i)) {
    const now = new Date()
    return { type: 'date', data: { date: now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) } }
  }
  
  const calcMatch = q.match(/^(\d+)\s*([+\-*/^])\s*(\d+)$/)
  if (calcMatch) {
    const a = parseFloat(calcMatch[1]), b = parseFloat(calcMatch[3])
    let result: number
    switch (calcMatch[2]) {
      case '+': result = a + b; break
      case '-': result = a - b; break
      case '*': result = a * b; break
      case '/': result = b !== 0 ? a / b : Infinity; break
      case '^': result = Math.pow(a, b); break
      default: return null
    }
    return { type: 'calculator', data: { expression: `${a} ${calcMatch[2]} ${b}`, result } }
  }
  
  const currencyMatch = q.match(/^(\d+(?:\.\d+)?)\s*(\w{3})\s+(?:to|in|into)\s+(\w{3})$/i)
  if (currencyMatch) {
    return { type: 'currency', data: { amount: currencyMatch[1], from: currencyMatch[2].toUpperCase(), to: currencyMatch[3].toUpperCase() } }
  }
  
  return null
}

// All search sources with detailed descriptions
const SEARCH_SOURCES = [
  // Video & Streaming
  { name: 'YouTube', domain: 'youtube.com', searchParam: 'search_query', icon: 'video', description: 'Watch videos, tutorials, reviews, and entertainment' },
  { name: 'TikTok', domain: 'tiktok.com', searchParam: 'q', icon: 'video', description: 'Short-form videos and trending content' },
  { name: 'Vimeo', domain: 'vimeo.com', searchParam: 'q', icon: 'video', description: 'Professional and creative videos' },
  { name: 'Twitch', domain: 'twitch.tv', searchParam: 'search', icon: 'video', description: 'Live streams and gaming content' },
  
  // Social Media
  { name: 'Twitter/X', domain: 'twitter.com', searchParam: 'q', icon: 'social', description: 'Latest tweets and trending discussions' },
  { name: 'Reddit', domain: 'reddit.com', searchParam: 'q', icon: 'social', description: 'Community discussions, forums, and news' },
  { name: 'Instagram', domain: 'instagram.com', searchParam: 'q', icon: 'social', description: 'Photos, stories, and social content' },
  { name: 'Facebook', domain: 'facebook.com', searchParam: 'q', icon: 'social', description: 'Social network posts and groups' },
  { name: 'LinkedIn', domain: 'linkedin.com', searchParam: 'q', icon: 'social', description: 'Professional networking and job search' },
  { name: 'Snapchat', domain: 'snapchat.com', searchParam: 'q', icon: 'social', description: 'Social media and stories' },
  { name: 'Pinterest', domain: 'pinterest.com', searchParam: 'q', icon: 'social', description: 'Ideas, inspiration, and visual discovery' },
  { name: 'Threads', domain: 'threads.net', searchParam: 'q', icon: 'social', description: 'Conversations and social discussions' },
  { name: 'Bluesky', domain: 'bsky.app', searchParam: 'q', icon: 'social', description: 'Decentralized social network' },
  
  // News & Media
  { name: 'Google News', domain: 'news.google.com', searchParam: 'q', icon: 'news', description: 'Breaking news and top headlines' },
  { name: 'CNN', domain: 'cnn.com', searchParam: 'q', icon: 'news', description: 'Breaking news, politics, and world events' },
  { name: 'BBC News', domain: 'bbc.com', searchParam: 'q', icon: 'news', description: 'World news and current affairs' },
  { name: 'Fox News', domain: 'foxnews.com', searchParam: 'q', icon: 'news', description: 'Breaking news and political coverage' },
  { name: 'NBC News', domain: 'nbcnews.com', searchParam: 'q', icon: 'news', description: 'Breaking news and investigative journalism' },
  { name: 'CBS News', domain: 'cbsnews.com', searchParam: 'q', icon: 'news', description: 'News, politics, and entertainment' },
  { name: 'ABC News', domain: 'abcnews.go.com', searchParam: 'q', icon: 'news', description: 'Breaking news and in-depth reporting' },
  { name: 'NPR', domain: 'npr.org', searchParam: 'q', icon: 'news', description: 'National public radio news and analysis' },
  { name: 'Reuters', domain: 'reuters.com', searchParam: 'q', icon: 'news', description: 'Global news and financial reporting' },
  { name: 'AP News', domain: 'apnews.com', searchParam: 'q', icon: 'news', description: 'Associated Press breaking news' },
  { name: 'The Guardian', domain: 'theguardian.com', searchParam: 'q', icon: 'news', description: 'Independent journalism and analysis' },
  { name: 'NY Times', domain: 'nytimes.com', searchParam: 'q', icon: 'news', description: 'In-depth news and investigative journalism' },
  { name: 'Washington Post', domain: 'washingtonpost.com', searchParam: 'q', icon: 'news', description: 'National and political news coverage' },
  { name: 'HuffPost', domain: 'huffpost.com', searchParam: 'q', icon: 'news', description: 'News, politics, and opinion pieces' },
  { name: 'Yahoo News', domain: 'news.yahoo.com', searchParam: 'q', icon: 'news', description: 'Latest news and headlines' },
  { name: 'MSN News', domain: 'msn.com', searchParam: 'q', icon: 'news', description: 'News, weather, and lifestyle content' },
  
  // Tech & Programming
  { name: 'GitHub', domain: 'github.com', searchParam: 'q', icon: 'tech', description: 'Open source code, projects, and repositories' },
  { name: 'Stack Overflow', domain: 'stackoverflow.com', searchParam: 'q', icon: 'tech', description: 'Programming Q&A and technical solutions' },
  { name: 'Hacker News', domain: 'news.ycombinator.com', searchParam: 'q', icon: 'tech', description: 'Tech news and startup discussions' },
  { name: 'Product Hunt', domain: 'producthunt.com', searchParam: 'q', icon: 'tech', description: 'New tech products and startups' },
  { name: 'Dev.to', domain: 'dev.to', searchParam: 'q', icon: 'tech', description: 'Developer articles and tutorials' },
  { name: 'TechCrunch', domain: 'techcrunch.com', searchParam: 'q', icon: 'tech', description: 'Tech news and startup coverage' },
  { name: 'Ars Technica', domain: 'arstechnica.com', searchParam: 'q', icon: 'tech', description: 'Technology news and analysis' },
  { name: 'Wired', domain: 'wired.com', searchParam: 'q', icon: 'tech', description: 'Tech culture, science, and business' },
  { name: 'The Verge', domain: 'theverge.com', searchParam: 'q', icon: 'tech', description: 'Tech news, product reviews, and culture' },
  { name: 'CNET', domain: 'cnet.com', searchParam: 'q', icon: 'tech', description: 'Tech product reviews and news' },
  { name: 'Mashable', domain: 'mashable.com', searchParam: 'q', icon: 'tech', description: 'Tech, culture, and social media news' },
  { name: 'Medium', domain: 'medium.com', searchParam: 'q', icon: 'tech', description: 'Articles and essays on various topics' },
  
  // Reference & Learning
  { name: 'Wikipedia', domain: 'wikipedia.org', searchParam: 'search', icon: 'reference', description: 'Free encyclopedia with detailed articles' },
  { name: 'Britannica', domain: 'britannica.com', searchParam: 'q', icon: 'reference', description: 'Encyclopedia and educational content' },
  { name: 'Wolfram Alpha', domain: 'wolframalpha.com', searchParam: 'i', icon: 'reference', description: 'Computational knowledge engine' },
  { name: 'Khan Academy', domain: 'khanacademy.org', searchParam: 'q', icon: 'reference', description: 'Free educational videos and lessons' },
  { name: 'Quizlet', domain: 'quizlet.com', searchParam: 'q', icon: 'reference', description: 'Flashcards and study tools' },
  { name: 'Coursera', domain: 'coursera.org', searchParam: 'q', icon: 'reference', description: 'Online courses from top universities' },
  { name: 'Udemy', domain: 'udemy.com', searchParam: 'q', icon: 'reference', description: 'Online learning and tutorials' },
  
  // Shopping & Reviews
  { name: 'Amazon', domain: 'amazon.com', searchParam: 'k', icon: 'shopping', description: 'Products, prices, and customer reviews' },
  { name: 'eBay', domain: 'ebay.com', searchParam: '_nkw', icon: 'shopping', description: 'Auctions and buy/sell marketplace' },
  { name: 'Walmart', domain: 'walmart.com', searchParam: 'q', icon: 'shopping', description: 'Everyday low prices and products' },
  { name: 'Target', domain: 'target.com', searchParam: 'q', icon: 'shopping', description: 'Products and deals' },
  { name: 'Best Buy', domain: 'bestbuy.com', searchParam: 'q', icon: 'shopping', description: 'Electronics and tech products' },
  { name: 'Yelp', domain: 'yelp.com', searchParam: 'find_desc', icon: 'shopping', description: 'Local business reviews and ratings' },
  { name: 'TripAdvisor', domain: 'tripadvisor.com', searchParam: 'q', icon: 'shopping', description: 'Travel reviews and booking' },
  { name: 'IMDb', domain: 'imdb.com', searchParam: 'q', icon: 'shopping', description: 'Movie and TV show information and reviews' },
  { name: 'Rotten Tomatoes', domain: 'rottentomatoes.com', searchParam: 'q', icon: 'shopping', description: 'Movie reviews and ratings' },
  { name: 'Goodreads', domain: 'goodreads.com', searchParam: 'q', icon: 'shopping', description: 'Book reviews and reading lists' },
  
  // Q&A & Community
  { name: 'Quora', domain: 'quora.com', searchParam: 'q', icon: 'qa', description: 'Questions, answers, and expert insights' },
  { name: 'Answers.com', domain: 'answers.com', searchParam: 'q', icon: 'qa', description: 'Q&A and encyclopedia answers' },
  { name: 'WikiAnswers', domain: 'qa.answers.com', searchParam: 'q', icon: 'qa', description: 'Community Q&A platform' },
  { name: 'Stack Exchange', domain: 'stackexchange.com', searchParam: 'q', icon: 'qa', description: 'Q&A communities on various topics' },
  
  // Finance & Business
  { name: 'Bloomberg', domain: 'bloomberg.com', searchParam: 'q', icon: 'finance', description: 'Financial news and market data' },
  { name: 'CNBC', domain: 'cnbc.com', searchParam: 'q', icon: 'finance', description: 'Business and financial news' },
  { name: 'Forbes', domain: 'forbes.com', searchParam: 'q', icon: 'finance', description: 'Business, investing, and leadership' },
  { name: 'Business Insider', domain: 'businessinsider.com', searchParam: 'q', icon: 'finance', description: 'Business and tech news' },
  { name: 'Wall Street Journal', domain: 'wsj.com', searchParam: 'q', icon: 'finance', description: 'Business and financial news coverage' },
  { name: 'MarketWatch', domain: 'marketwatch.com', searchParam: 'q', icon: 'finance', description: 'Stock market data and financial news' },
  
  // Sports & Entertainment
  { name: 'ESPN', domain: 'espn.com', searchParam: 'q', icon: 'sports', description: 'Sports news, scores, and highlights' },
  { name: 'Sports Illustrated', domain: 'si.com', searchParam: 'q', icon: 'sports', description: 'Sports news and analysis' },
  { name: 'TMZ', domain: 'tmz.com', searchParam: 'q', icon: 'entertainment', description: 'Celebrity news and gossip' },
  { name: 'E! Online', domain: 'eonline.com', searchParam: 'q', icon: 'entertainment', description: 'Entertainment news and celebrities' },
  { name: 'Variety', domain: 'variety.com', searchParam: 'q', icon: 'entertainment', description: 'Entertainment industry news' },
  { name: 'Pitchfork', domain: 'pitchfork.com', searchParam: 'q', icon: 'entertainment', description: 'Music reviews and news' },
  
  // Search Engines
  { name: 'Google', domain: 'google.com', searchParam: 'q', icon: 'search', description: 'Web search and information' },
  { name: 'Bing', domain: 'bing.com', searchParam: 'q', icon: 'search', description: 'Microsoft web search' },
  { name: 'DuckDuckGo', domain: 'duckduckgo.com', searchParam: 'q', icon: 'search', description: 'Private web search' },
  { name: 'Yahoo', domain: 'search.yahoo.com', searchParam: 'p', icon: 'search', description: 'Web search and news' },
]

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')

  if (!query) {
    return NextResponse.json({ error: 'Query required' }, { status: 400 })
  }

  const cacheKey = `search:${query.toLowerCase()}`
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json(cached.data)
  }

  const queryLower = query.toLowerCase()
  const isAdult = isAdultQuery(query)
  
  const matchedPanel = !isAdult ? KNOWLEDGE_PANELS.find(p => queryLower.includes(p.keyword) || p.keyword.includes(queryLower)) : null
  const richResult = parseQueryForRichResults(query)

  const results: { title: string; link: string; snippet: string; favicon?: string; domain?: string; icon?: string }[] = []
  const images: { title: string; link: string; thumbnail: string }[] = []
  let featuredSnippet: { title: string; link: string; snippet: string } | null = null
  let relatedQuestions: string[] = []
  let wikiKnowledge: { title: string; description: string; image?: string; facts: Record<string, string> } | null = null

  // Handle rich results
  if (richResult) {
    let richAnswer = null
    
    if (richResult.type === 'time') {
      richAnswer = { type: 'time', data: richResult.data }
    } else if (richResult.type === 'date') {
      richAnswer = { type: 'date', data: richResult.data }
    } else if (richResult.type === 'calculator') {
      richAnswer = { type: 'calculator', data: richResult.data }
    } else if (richResult.type === 'currency') {
      try {
        const from = richResult.data.from as string
        const to = richResult.data.to as string
        const rateRes = await fetch('https://api.exchangerate-api.com/v4/latest/' + from)
        const rateData = await rateRes.json()
        const rate = rateData.rates?.[to]
        if (rate) {
          const amount = parseFloat(richResult.data.amount as string)
          richAnswer = { type: 'currency', data: { ...richResult.data, rate, result: (amount * rate).toFixed(2) } }
        }
      } catch {}
    }
    
    if (richAnswer) {
      return NextResponse.json({ results: [], images: [], aiSummary: null, knowledgePanel: matchedPanel || null, richResult: richAnswer })
    }
  }

  try {
    // 1. Add all search sources as results
    for (const source of SEARCH_SOURCES) {
      results.push({
        title: `${source.name} - ${query}`,
        link: `https://www.${source.domain}/search?${source.searchParam}=${encodeURIComponent(query)}`,
        snippet: source.description,
        icon: source.icon
      })
    }

    // 2. Get Wikipedia content for knowledge panel
    if (!isAdult) {
      try {
        const encodedQuery = encodeURIComponent(query)
        
        const summaryRes = await fetch(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${encodedQuery}`,
          { headers: { 'User-Agent': 'Sift/1.0' } }
        )
        
        if (summaryRes.ok) {
          const summaryData = await summaryRes.json()
          
          wikiKnowledge = {
            title: summaryData.title,
            description: summaryData.extract || summaryData.description || '',
            image: summaryData.thumbnail?.source || summaryData.originalimage?.source,
            facts: {}
          }
          
          featuredSnippet = {
            title: summaryData.title,
            link: summaryData.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodedQuery}`,
            snippet: summaryData.extract || ''
          }
        }
      } catch {}

      try {
        const wikiSearchRes = await fetch(
          `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*&srlimit=10`,
          { headers: { 'User-Agent': 'Sift/1.0' } }
        )
        const wikiSearchData = await wikiSearchRes.json()
        
        if (wikiSearchData.query?.search) {
          relatedQuestions = wikiSearchData.query.search.slice(0, 5).map((item: { title: string }) => 
            `What is ${item.title}?`
          )
        }
      } catch {}
    }

    // 3. Brave Search (if API key available)
    const braveKey = process.env.BRAVE_API_KEY
    if (braveKey) {
      try {
        const braveRes = await fetch(
          `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=20`,
          { headers: { 'X-Subscription-Token': braveKey, 'Accept': 'application/json' } }
        )
        const braveData = await braveRes.json()
        
        if (braveData.web?.results) {
          for (const r of braveData.web.results) {
            const exists = results.some(x => x.link === r.url)
            if (!exists) {
              results.push({
                title: r.title,
                link: r.url,
                snippet: r.description || '',
                icon: 'web'
              })
            }
          }
        }
        
        if (braveData.images?.results) {
          for (const img of braveData.images.results.slice(0, 30)) {
            images.push({
              title: img.title || query,
              link: img.url,
              thumbnail: img.thumbnail?.url || img.url
            })
          }
        }
      } catch {}
    }

    // 4. Get images from Wikipedia
    if (images.length === 0 && !isAdult) {
      try {
        const imgRes = await fetch(
          `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(query)}&prop=pageimages&format=json&origin=*&pithumbsize=500`,
          { headers: { 'User-Agent': 'Sift/1.0' } }
        )
        const imgData = await imgRes.json()
        const pages = imgData.query?.pages || {}
        
        for (const pageId of Object.keys(pages)) {
          if (pages[pageId].thumbnail && images.length < 20) {
            images.push({
              title: pages[pageId].title,
              link: `https://en.wikipedia.org/wiki/${encodeURIComponent(pages[pageId].title.replace(/ /g, '_'))}`,
              thumbnail: pages[pageId].thumbnail.source
            })
          }
        }
      } catch {}
    }

    if (images.length === 0) {
      for (let i = 0; i < 20; i++) {
        images.push({
          title: `${query} ${i + 1}`,
          link: `https://www.google.com/search?q=${encodeURIComponent(query)} images`,
          thumbnail: `https://picsum.photos/seed/${query.replace(/\s+/g, '')}${i}/400/400`
        })
      }
    }

    // Add favicons
    const seen = new Set<string>()
    const dedupedResults = results.filter(r => {
      if (seen.has(r.link)) return false
      seen.add(r.link)
      let hostname = ''
      try { hostname = new URL(r.link).hostname } catch {}
      r.favicon = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`
      r.domain = hostname
      return true
    }).slice(0, 50)

    // AI Summary
    let aiSummary = null
    const snippets = dedupedResults.slice(0, 10).map(r => r.snippet).filter(Boolean).join(' ')
    const aiPrompt = `About "${query}": ${snippets || wikiKnowledge?.description || ''}. Give a 2-3 sentence helpful answer. Sound natural.`

    if (process.env.GEMINI_API_KEY) {
      try {
        const aiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: aiPrompt }] }] }) }
        )
        const aiData = await aiRes.json()
        if (aiData.candidates?.[0]?.content?.parts?.[0]?.text) {
          aiSummary = { answer: aiData.candidates[0].content.parts[0].text, sources: dedupedResults.slice(0, 5).map(r => r.domain || '') }
        }
      } catch {}
    }

    if (!aiSummary && process.env.GROQ_API_KEY) {
      try {
        const aiRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST', headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'llama-3.1-8b-instant', messages: [{ role: 'user', content: aiPrompt }], max_tokens: 150 })
        })
        const aiData = await aiRes.json()
        if (aiData.choices?.[0]?.message?.content) {
          aiSummary = { answer: aiData.choices[0].message.content, sources: dedupedResults.slice(0, 5).map(r => r.domain || '') }
        }
      } catch {}
    }

    if (!aiSummary && featuredSnippet) {
      aiSummary = { answer: featuredSnippet.snippet, sources: ['Wikipedia'] }
    }

    const response = {
      results: dedupedResults,
      images: images.slice(0, 30),
      aiSummary,
      knowledgePanel: matchedPanel || null,
      wikiKnowledge,
      featuredSnippet,
      relatedQuestions
    }
    
    cache.set(cacheKey, { data: response, timestamp: Date.now() })
    return NextResponse.json(response)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ results: [], images: [], aiSummary: null, knowledgePanel: null }, { status: 500 })
  }
}
