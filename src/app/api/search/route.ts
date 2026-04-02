import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')

  if (!query) {
    return NextResponse.json({ error: 'Query required' }, { status: 400 })
  }

  try {
    // Search for web results
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    })
    const html = await response.text()

    // Parse web results
    const results: { title: string; link: string; snippet: string }[] = []
    const titleRegex = /<a class="result__a" href="([^"]+)">([^<]+)<\/a>/g
    const snippetRegex = /<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g
    
    let titleMatches = [...html.matchAll(titleRegex)]
    let snippetMatches = [...html.matchAll(snippetRegex)]
    
    for (let i = 0; i < Math.min(titleMatches.length, 10); i++) {
      const link = titleMatches[i][1]
      const title = titleMatches[i][2].replace(/<[^>]+>/g, '').trim()
      const snippet = snippetMatches[i] 
        ? snippetMatches[i][1].replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').trim()
        : ''
      
      if (title && link && !link.includes('duckduckgo') && !link.includes('yandex')) {
        results.push({ title, link, snippet })
      }
    }

    // Search for images
    const imageUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query + ' images')}`
    const imageResponse = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    })
    const imageHtml = await imageResponse.text()
    
    // Try to find image links from DDG
    const images: { title: string; link: string; thumbnail: string }[] = []
    const imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/g
    const imgMatches = [...imageHtml.matchAll(imgRegex)]
    
    // Use a free image API as fallback
    const picsumUrl = `https://picsum.photos/v2/list?limit=12&query=${encodeURIComponent(query)}`
    try {
      const picsumResponse = await fetch(picsumUrl)
      const picsumData = await picsumResponse.json()
      
      for (const img of picsumData.slice(0, 12)) {
        images.push({
          title: `Photo by ${img.author}`,
          link: img.url,
          thumbnail: `https://picsum.photos/id/${img.id}/300/300`
        })
      }
    } catch {
      // Use placeholder images if API fails
      for (let i = 0; i < 12; i++) {
        images.push({
          title: `Image ${i + 1}`,
          link: '#',
          thumbnail: `https://picsum.photos/300/300?random=${i}`
        })
      }
    }

    // Get AI summary if API key is available
    let aiSummary = null
    const snippets = results.slice(0, 3).map(r => r.snippet || r.title).join(' | ')
    const aiPrompt = `Based on these search results for "${query}": ${snippets}. Give a brief 2-3 sentence answer.`
    
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
              try {
                return new URL(r.link).hostname.replace('www.', '')
              } catch {
                return r.link
              }
            })
          }
        }
      } catch (err) {
        console.error('Gemini error:', err)
      }
    }
    
    // Try Groq
    const groqKey = process.env.GROQ_API_KEY
    if (!aiSummary && groqKey && results.length > 0) {
      try {
        const aiRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${groqKey}`,
            'Content-Type': 'application/json'
          },
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
              try {
                return new URL(r.link).hostname.replace('www.', '')
              } catch {
                return r.link
              }
            })
          }
        }
      } catch (err) {
        console.error('Groq error:', err)
      }
    }

    // Try Cloudflare
    const cfKey = process.env.CLOUDFLARE_API_TOKEN
    if (!aiSummary && cfKey && results.length > 0) {
      try {
        const aiRes = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/meta/llama-3-8b-instruct`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${cfKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              messages: [
                { role: 'system', content: 'You give brief answers based on search results.' },
                { role: 'user', content: aiPrompt }
              ],
              max_tokens: 200
            })
          }
        )
        const aiData = await aiRes.json()
        if (aiData.result?.response) {
          aiSummary = {
            answer: aiData.result.response,
            sources: results.slice(0, 3).map(r => {
              try {
                return new URL(r.link).hostname.replace('www.', '')
              } catch {
                return r.link
              }
            })
          }
        }
      } catch (err) {
        console.error('Cloudflare error:', err)
      }
    }

    return NextResponse.json({ results, images, aiSummary })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
