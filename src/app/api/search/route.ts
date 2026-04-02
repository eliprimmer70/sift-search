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
    
    // DuckDuckGo Instant Answer API
    const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
    
    try {
      const ddgResponse = await fetch(ddgUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Sift/1.0)' }
      })
      const ddgData = await ddgResponse.json()
      
      // Add abstract/definition if available
      if (ddgData.AbstractText && ddgData.AbstractURL) {
        results.push({
          title: ddgData.Heading || query,
          link: ddgData.AbstractURL,
          snippet: ddgData.AbstractText.substring(0, 300)
        })
      }
      
      // Add "More at" results
      if (ddgData.RelatedResults) {
        for (const res of ddgData.RelatedResults.slice(0, 5)) {
          if (res.Text && res.FirstURL) {
            results.push({
              title: res.Text.substring(0, 100),
              link: res.FirstURL,
              snippet: res.Text.substring(0, 200)
            })
          }
        }
      }
      
      // Add related topics
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
    } catch {
      console.log('DuckDuckGo API failed')
    }

    // If no results, try Bing search fallback via serpdog free API
    if (results.length === 0) {
      try {
        const serpApiKey = process.env.SERP_API_KEY
        if (serpApiKey) {
          const serpRes = await fetch(
            `https://api.serpdog.io/search?api_key=${serpApiKey}&q=${encodeURIComponent(query)}&num=10`
          )
          const serpData = await serpRes.json()
          if (serpData.results) {
            for (const r of serpData.results) {
              results.push({
                title: r.title,
                link: r.link,
                snippet: r.snippet || r.description
              })
            }
          }
        }
      } catch {}

      // Final fallback: generate results from Wikipedia search
      if (results.length === 0) {
        try {
          const wikiRes = await fetch(
            `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=10&format=json`,
            { headers: { 'User-Agent': 'Sift/1.0' } }
          )
          const wikiData = await wikiRes.json()
          if (wikiData[1] && wikiData[1].length > 0) {
            for (let i = 0; i < wikiData[1].length; i++) {
              results.push({
                title: wikiData[1][i],
                link: wikiData[3][i],
                snippet: `Learn more about ${wikiData[1][i]} on Wikipedia`
              })
            }
          }
        } catch {}
      }

      // Ultimate fallback: create search URLs for major sites
      if (results.length === 0) {
        const searchQuery = encodeURIComponent(query)
        results.push(
          {
            title: `Search for "${query}" on Google`,
            link: `https://www.google.com/search?q=${searchQuery}`,
            snippet: `Find information about ${query} on Google`
          },
          {
            title: `Search for "${query}" on Bing`,
            link: `https://www.bing.com/search?q=${searchQuery}`,
            snippet: `Find information about ${query} on Bing`
          },
          {
            title: `Search for "${query}" on Wikipedia`,
            link: `https://en.wikipedia.org/w/index.php?search=${searchQuery}`,
            snippet: `Find information about ${query} on Wikipedia`
          },
          {
            title: `Search for "${query}" on YouTube`,
            link: `https://www.youtube.com/results?search_query=${searchQuery}`,
            snippet: `Watch videos about ${query} on YouTube`
          },
          {
            title: `Search for "${query}" on Reddit`,
            link: `https://www.reddit.com/search/?q=${searchQuery}`,
            snippet: `Find discussions about ${query} on Reddit`
          },
          {
            title: `Search for "${query}" on Twitter`,
            link: `https://twitter.com/search?q=${searchQuery}`,
            snippet: `See what people are saying about ${query}`
          },
          {
            title: `Search for "${query}" on GitHub`,
            link: `https://github.com/search?q=${searchQuery}`,
            snippet: `Find code and projects related to ${query} on GitHub`
          },
          {
            title: `Search for "${query}" on Amazon`,
            link: `https://www.amazon.com/s?k=${searchQuery}`,
            snippet: `Find products related to ${query} on Amazon`
          },
          {
            title: `Search for "${query}" on Quora`,
            link: `https://www.quora.com/search?q=${searchQuery}`,
            snippet: `Find answers and discussions about ${query} on Quora`
          },
          {
            title: `Search for "${query}" on Stack Overflow`,
            link: `https://stackoverflow.com/search?q=${searchQuery}`,
            snippet: `Find technical answers about ${query} on Stack Overflow`
          }
        )
      }
    }

    // Get images - always show Picsum as fallback
    try {
      const picsumResponse = await fetch(`https://picsum.photos/v2/list?limit=15`)
      const picsumData = await picsumResponse.json()
      
      // Try to get relevant images first
      let gotRelevant = false
      
      // Try Unsplash source API
      try {
        const unsplashRes = await fetch(`https://source.unsplash.com/featured/?${encodeURIComponent(query)}/12`, {
          redirect: 'follow'
        })
        if (unsplashRes.ok) {
          for (let i = 0; i < 12; i++) {
            images.push({
              title: `Image ${i + 1}`,
              link: `https://unsplash.com/s/photos/${encodeURIComponent(query)}`,
              thumbnail: `https://source.unsplash.com/featured/300x300?${encodeURIComponent(query)}&sig=${i}`
            })
          }
          gotRelevant = true
        }
      } catch {}

      // Fallback to Picsum with search query
      if (!gotRelevant) {
        for (const img of picsumData.slice(0, 15)) {
          images.push({
            title: `Photo by ${img.author} - ${query}`,
            link: img.url,
            thumbnail: `https://picsum.photos/id/${img.id}/300/300`
          })
        }
      }
    } catch {
      // Ultimate fallback for images
      for (let i = 0; i < 12; i++) {
        images.push({
          title: `Image ${i + 1} - ${query}`,
          link: '#',
          thumbnail: `https://picsum.photos/300/300?random=${i}&text=${encodeURIComponent(query)}`
        })
      }
    }

    // AI Summary
    let aiSummary = null
    const snippets = results.slice(0, 5).map(r => r.snippet || r.title).join(' | ')
    const aiPrompt = `User searched for "${query}". Provide a helpful 2-3 sentence answer about this topic.${snippets ? ` Here is some context: ${snippets}` : ''}`
    
    // Try Gemini
    const geminiKey = process.env.GEMINI_API_KEY
    if (geminiKey) {
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
    if (!aiSummary && groqKey) {
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

    // Try Cloudflare AI
    if (!aiSummary) {
      const cfAccountId = process.env.CF_ACCOUNT_ID
      const cfToken = process.env.CF_API_TOKEN
      if (cfAccountId && cfToken) {
        try {
          const cfRes = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/ai/run/@cf/meta/llama-3.1-8b-instant`,
            {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${cfToken}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ messages: [{ role: 'user', content: aiPrompt }] })
            }
          )
          const cfData = await cfRes.json()
          if (cfData.result?.response) {
            aiSummary = {
              answer: cfData.result.response,
              sources: results.slice(0, 3).map(r => {
                try { return new URL(r.link).hostname.replace('www.', '') } 
                catch { return r.link }
              })
            }
          }
        } catch {}
      }
    }

    // Generate a basic summary if no AI available
    if (!aiSummary && results.length > 0) {
      aiSummary = {
        answer: `This search for "${query}" returned ${results.length} results. Check the links below for more information.`,
        sources: results.slice(0, 3).map(r => {
          try { return new URL(r.link).hostname.replace('www.', '') } 
          catch { return r.link }
        })
      }
    }

    return NextResponse.json({ results, images, aiSummary })
  } catch (err) {
    console.error(err)
    // Return fallback results even on error
    const fallbackQuery = encodeURIComponent(query || 'search')
    return NextResponse.json({
      results: [
        { title: `Search on Google`, link: `https://google.com/search?q=${fallbackQuery}`, snippet: `Find results for this query on Google` },
        { title: `Search on Bing`, link: `https://bing.com/search?q=${fallbackQuery}`, snippet: `Find results for this query on Bing` },
      ],
      images: Array(12).fill(null).map((_, i) => ({
        title: `Image ${i + 1}`,
        link: '#',
        thumbnail: `https://picsum.photos/300/300?random=${i}`
      })),
      aiSummary: {
        answer: `Showing search results for "${query}". Click any link below to learn more.`,
        sources: ['google.com', 'bing.com']
      }
    })
  }
}
