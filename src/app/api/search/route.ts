import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')

  if (!query) {
    return NextResponse.json({ error: 'Query required' }, { status: 400 })
  }

  try {
    // Use DuckDuckGo HTML for search results (free, no API key)
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    })

    const html = await response.text()
    
    // Parse results from HTML
    const results: { title: string; link: string; snippet: string }[] = []
    const resultRegex = /<a class="result__a" href="([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g
    let match
    
    while ((match = resultRegex.exec(html)) !== null && results.length < 10) {
      const link = match[1]
      const title = match[2].replace(/<[^>]+>/g, '').trim()
      const snippet = match[3].replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').trim()
      
      if (title && link && !link.includes('duckduckgo')) {
        results.push({ title, link, snippet })
      }
    }

    // If parsing failed, try simpler regex
    if (results.length === 0) {
      const simpleRegex = /<a class="result__a" href="([^"]+)">([^<]+)<\/a>/g
      while ((match = simpleRegex.exec(html)) !== null && results.length < 10) {
        const link = match[1]
        const title = match[2].replace(/<[^>]+>/g, '').trim()
        if (title && link && !link.includes('duckduckgo') && !results.some(r => r.link === link)) {
          results.push({ title, link, snippet: '' })
        }
      }
    }

    // Get AI summary if API key is available
    let aiSummary = null
    const aiKey = process.env.GROQ_API_KEY || process.env.CLOUDFLARE_API_TOKEN
    
    if (aiKey && results.length > 0) {
      try {
        const snippets = results.slice(0, 3).map(r => r.snippet || r.title).join(' | ')
        const aiPrompt = `Based on these search results for "${query}": ${snippets}. Give a Brief 2-3 sentence answer.`

        if (process.env.GROQ_API_KEY) {
          const aiRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
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
        } else if (process.env.CLOUDFLARE_API_TOKEN) {
          const aiRes = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/meta/llama-3-8b-instruct`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
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
        }
      } catch (err) {
        console.error('AI summary error:', err)
      }
    }

    return NextResponse.json({ results, aiSummary })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
