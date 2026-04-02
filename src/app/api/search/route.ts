import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')

  if (!query) {
    return NextResponse.json({ error: 'Query required' }, { status: 400 })
  }

  try {
    // Use DuckDuckGo lite for better parsing
    const searchUrl = `https://lite.duckduckgo.com/50x/?q=${encodeURIComponent(query)}`
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    })
    const html = await response.text()

    // Parse results - look for result links and snippets
    const results: { title: string; link: string; snippet: string }[] = []
    
    // Match result links
    const linkMatches = html.match(/<a class="result__a" href="([^"]+)"[^>]*>([^<]+)<\/a>/g) || []
    
    // Match snippets
    const snippetMatches = html.match(/<a class="result__snippet"[^>]*>([^<]+)<\/a>/g) || []
    
    // Extract data
    for (let i = 0; i < Math.min(linkMatches.length, 10); i++) {
      const linkMatch = linkMatches[i].match(/href="([^"]+)"/)
      const titleMatch = linkMatches[i].match(/>([^<]+)<\/a>/)
      
      if (linkMatch && titleMatch) {
        const link = linkMatch[1]
        const title = titleMatch[1].replace(/<[^>]+>/g, '').trim()
        
        let snippet = ''
        if (snippetMatches[i]) {
          snippet = snippetMatches[i].replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').trim()
        }
        
        if (title && link && !link.includes('duckduckgo') && !link.includes('yandex')) {
          results.push({ title, link, snippet })
        }
      }
    }

    // If still no results, try regex approach on full HTML
    if (results.length === 0) {
      const allLinks = html.match(/<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([^<]+)<\/a>/g) || []
      const seen = new Set()
      
      for (const linkHtml of allLinks) {
        if (results.length >= 10) break
        
        const hrefMatch = linkHtml.match(/href="(https?:\/\/[^"]+)"/)
        const textMatch = linkHtml.match(/>([^<]+)<\/a>/)
        
        if (hrefMatch && textMatch) {
          const link = hrefMatch[1]
          const title = textMatch[1].replace(/<[^>]+>/g, '').trim()
          
          // Filter out navigation links and internal links
          if (
            title && 
            link && 
            link.startsWith('http') &&
            !link.includes('duckduckgo') &&
            !link.includes('yandex.com') &&
            !seen.has(link) &&
            title.length > 10 &&
            !title.includes('About') &&
            !title.includes('Privacy')
          ) {
            seen.add(link)
            results.push({ title, link, snippet: '' })
          }
        }
      }
    }

    // Get images from Picsum
    const images: { title: string; link: string; thumbnail: string }[] = []
    try {
      const picsumResponse = await fetch(`https://picsum.photos/v2/list?limit=12`)
      const picsumData = await picsumResponse.json()
      
      for (const img of picsumData.slice(0, 12)) {
        images.push({
          title: `Photo by ${img.author}`,
          link: img.url,
          thumbnail: `https://picsum.photos/id/${img.id}/300/300`
        })
      }
    } catch {
      for (let i = 0; i < 12; i++) {
        images.push({
          title: `Image ${i + 1}`,
          link: '#',
          thumbnail: `https://picsum.photos/300/300?random=${i}`
        })
      }
    }

    // AI Summary
    let aiSummary = null
    const snippets = results.slice(0, 3).map(r => r.snippet || r.title).join(' | ')
    const aiPrompt = `For "${query}": ${snippets}. Give a 2-3 sentence answer.`
    
    // Try Gemini
    const geminiKey = process.env.GEMINI_API_KEY
    if (geminiKey && results.length > 0) {
      try {
        const aiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: aiPrompt }] }]
            })
          }
        )
        const aiData = await aiRes.json()
        if (aiData.candidates?.[0]?.content?.parts?.[0]?.text) {
          aiSummary = {
            answer: aiData.candidates[0].content.parts[0].text,
            sources: results.slice(0, 3).map(r => {
              try { return new URL(r.link).hostname.replace('www.', '') } 
              catch { return r.link }
            })
          }
        }
      } catch {}
    }
    
    // Try Groq
    const groqKey = process.env.GROQ_API_KEY
    if (!aiSummary && groqKey && results.length > 0) {
      try {
        const aiRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'llama-3.1-8b-instant',
            messages: [{ role: 'user', content: aiPrompt }],
            max_tokens: 200
          })
        })
        const aiData = await aiRes.json()
        if (aiData.choices?.[0]?.message?.content) {
          aiSummary = {
            answer: aiData.choices[0].message.content,
            sources: results.slice(0, 3).map(r => {
              try { return new URL(r.link).hostname.replace('www.', '') } 
              catch { return r.link }
            })
          }
        }
      } catch {}
    }

    return NextResponse.json({ results, images, aiSummary })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ results: [], images: [], aiSummary: null })
  }
}
