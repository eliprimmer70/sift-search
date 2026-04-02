import { NextResponse } from 'next/server'

const cache = new Map<string, { data: unknown; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000

// Built-in knowledge panels
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

  const results: { title: string; link: string; snippet: string; favicon?: string; domain?: string }[] = []
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
    // 1. Get Wikipedia content for knowledge panel
    if (!isAdult) {
      try {
        const encodedQuery = encodeURIComponent(query)
        
        // Get page summary
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
          
          // Set as featured snippet
          featuredSnippet = {
            title: summaryData.title,
            link: summaryData.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodedQuery}`,
            snippet: summaryData.extract || ''
          }
        }
      } catch {}

      // Get full Wikipedia search results
      try {
        const wikiSearchRes = await fetch(
          `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*&srlimit=20`,
          { headers: { 'User-Agent': 'Sift/1.0' } }
        )
        const wikiSearchData = await wikiSearchRes.json()
        
        if (wikiSearchData.query?.search) {
          for (const item of wikiSearchData.query.search) {
            const cleanSnippet = item.snippet?.replace(/<[^>]*>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&') || ''
            results.push({
              title: item.title,
              link: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`,
              snippet: cleanSnippet.substring(0, 250)
            })
          }
          
          // Generate related questions from search titles
          relatedQuestions = wikiSearchData.query.search.slice(0, 5).map((item: { title: string }) => 
            `What is ${item.title}?`
          )
        }
      } catch {}
    }

    // 2. Brave Search
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
                snippet: r.description || ''
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
        
        // Get knowledge panel from Brave
        if (!wikiKnowledge && braveData.knowledge_panel) {
          const kp = braveData.knowledge_panel
          wikiKnowledge = {
            title: kp.graph_metadata?.title || query,
            description: kp.description || '',
            image: kp.graph_metadata?.image,
            facts: {}
          }
          if (kp.attributes) {
            for (const [key, value] of Object.entries(kp.attributes)) {
              if (typeof value === 'string') {
                wikiKnowledge.facts[key] = value
              }
            }
          }
        }
      } catch {}
    }

    // 3. DuckDuckGo Lite
    if (results.length < 5) {
      try {
        const ddgRes = await fetch(
          `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`,
          { headers: { 'User-Agent': 'Mozilla/5.0' } }
        )
        const ddgText = await ddgRes.text()
        
        const links = ddgText.match(/<a[^>]+href="(https:\/\/[^"]+)"[^>]*>[^<]*<\/a>/gi) || []
        const snippets = ddgText.match(/<span[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/span>/gi) || []
        
        for (let i = 0; i < Math.min(links.length, snippets.length, 15); i++) {
          const linkMatch = links[i].match(/href="(https:\/\/[^"]+)"/)
          const titleMatch = links[i].match(/>([^<]+)<\/a>/)
          const snippetText = snippets[i]?.replace(/<[^>]*>/g, '').trim() || ''
          
          if (linkMatch && titleMatch) {
            const link = linkMatch[1]
            const exists = results.some(x => x.link === link)
            if (!exists && !link.includes('duckduckgo')) {
              results.push({
                title: titleMatch[1].trim(),
                link,
                snippet: snippetText.substring(0, 200)
              })
            }
          }
        }
      } catch {}
    }

    // Fallback if no results
    if (results.length === 0) {
      results.push(
        { title: `${query} on YouTube`, link: `https://youtube.com/results?search_query=${encodeURIComponent(query)}`, snippet: `Watch videos about ${query}` },
        { title: `${query} on Reddit`, link: `https://reddit.com/search/?q=${encodeURIComponent(query)}`, snippet: `Discussions about ${query}` },
        { title: `${query} on Twitter`, link: `https://twitter.com/search?q=${encodeURIComponent(query)}`, snippet: `See what people say about ${query}` },
        { title: `${query} on Wikipedia`, link: `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(query)}`, snippet: `Encyclopedia article about ${query}` }
      )
    }

    // Get images from Wikipedia
    if (images.length === 0) {
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
          link: `https://google.com/search?q=${encodeURIComponent(query)} images`,
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
    }).slice(0, 30)

    // AI Summary
    let aiSummary = null
    const snippets = dedupedResults.slice(0, 3).map(r => r.snippet).filter(Boolean).join(' ')
    const aiPrompt = `About "${query}": ${snippets || wikiKnowledge?.description || ''}. Give a 2-3 sentence helpful answer. Sound natural.`

    if (process.env.GEMINI_API_KEY) {
      try {
        const aiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: aiPrompt }] }] }) }
        )
        const aiData = await aiRes.json()
        if (aiData.candidates?.[0]?.content?.parts?.[0]?.text) {
          aiSummary = { answer: aiData.candidates[0].content.parts[0].text, sources: dedupedResults.slice(0, 3).map(r => r.domain || '') }
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
          aiSummary = { answer: aiData.choices[0].message.content, sources: dedupedResults.slice(0, 3).map(r => r.domain || '') }
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
