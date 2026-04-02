import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')

  if (!query) {
    return NextResponse.json({ error: 'Query required' }, { status: 400 })
  }

  try {
    // Try Bing search
    const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    })
    const html = await response.text()

    // Parse Bing results
    const results: { title: string; link: string; snippet: string }[] = []
    
    // Bing result pattern
    const bingRegex = /<li class="b_algo"[\s\S]*?<h2[^>]*>([\s\S]*?)<\/h2>[\s\S]*?<div class="b_caption"[\s\S]*?<p>([\s\S]*?)<\/p>/g
    
    let match
    while ((match = bingRegex.exec(html)) !== null && results.length < 10) {
      const titleMatch = match[1].match(/<a[^>]*>([^<]+)<\/a>/)
      const urlMatch = match[1].match(/href="([^"]+)"/)
      const snippet = match[2].replace(/<[^>]+>/g, '').trim()
      
      if (titleMatch && urlMatch) {
        const title = titleMatch[1].replace(/<[^>]+>/g, '').trim()
        const link = urlMatch[1]
        
        if (title && link && !link.includes('microsoft') && !link.includes('bing')) {
          results.push({ title, link, snippet })
        }
      }
    }

    // Fallback: simpler regex for Bing
    if (results.length === 0) {
      const simpleTitleRegex = /<h2[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g
      while ((match = simpleTitleRegex.exec(html)) !== null && results.length < 10) {
        const link = match[1]
        const title = match[2].replace(/<[^>]+>/g, '').trim()
        
        if (title && link && link.startsWith('http') && !link.includes('bing.com') && !link.includes('microsoft')) {
          results.push({ title, link, snippet: '' })
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
