import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')

  if (!query) {
    return NextResponse.json({ error: 'Query required' }, { status: 400 })
  }

  try {
    const results: { title: string; link: string; snippet: string }[] = []
    const images: { title: string; link: string; thumbnail: string }[] = []
    
    // Use DuckDuckGo's API
    const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`
    
    try {
      const ddgResponse = await fetch(ddgUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      })
      const ddgData = await ddgResponse.json()
      
      // Add related topics as results
      if (ddgData.RelatedTopics) {
        for (const topic of ddgData.RelatedTopics.slice(0, 10)) {
          if (topic.Text && topic.FirstURL) {
            results.push({
              title: topic.Text.substring(0, 100),
              link: topic.FirstURL,
              snippet: topic.Text.substring(0, 200)
            })
          }
        }
      }
      
      // Add abstract if available
      if (ddgData.AbstractText && ddgData.AbstractURL) {
        results.unshift({
          title: ddgData.Heading || query,
          link: ddgData.AbstractURL,
          snippet: ddgData.AbstractText.substring(0, 300)
        })
      }
    } catch {
      console.log('DuckDuckGo API failed')
    }

    // Get images from Picsum
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
