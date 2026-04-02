import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')

  if (!query) {
    return NextResponse.json({ error: 'Query required' }, { status: 400 })
  }

  const articles: { title: string; link: string; snippet: string; source: string; date: string; image?: string }[] = []
  const seen = new Set<string>()

  try {
    // 1. NewsData.io API (free tier - 200 requests/day)
    const newsDataKey = process.env.NEWSDATA_API_KEY
    if (newsDataKey) {
      try {
        const newsDataRes = await fetch(
          `https://newsdata.io/api/1/news?apikey=${newsDataKey}&q=${encodeURIComponent(query)}&language=en&category=science,technology,top,world`,
          { headers: { 'User-Agent': 'Sift/1.0' } }
        )
        const newsData = await newsDataRes.json()
        
        if (newsData.results) {
          for (const article of newsData.results) {
            if (article.link && !seen.has(article.link)) {
              seen.add(article.link)
              articles.push({
                title: article.title || '',
                link: article.link,
                snippet: article.description || article.content || '',
                source: article.source_id || article.source_name || 'NewsData',
                date: article.pubDate || '',
                image: article.image_url || undefined
              })
            }
          }
        }
      } catch {}
    }

    // 2. NewsAPI.org (free tier - 100 requests/day)
    const newsApiKey = process.env.NEWS_API_KEY
    if (newsApiKey && articles.length < 15) {
      try {
        const newsApiRes = await fetch(
          `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&sortBy=publishedAt&language=en&pageSize=20&apiKey=${newsApiKey}`
        )
        const newsApi = await newsApiRes.json()
        
        if (newsApi.articles) {
          for (const article of newsApi.articles) {
            if (article.url && !seen.has(article.url)) {
              seen.add(article.url)
              articles.push({
                title: article.title || '',
                link: article.url,
                snippet: article.description || article.content || '',
                source: article.source?.name || 'NewsAPI',
                date: article.publishedAt || '',
                image: article.urlToImage || undefined
              })
            }
          }
        }
      } catch {}
    }

    // 3. RSS to JSON converter for Google News (has images)
    if (articles.length < 15) {
      try {
        const rssRes = await fetch(
          `https://api.rss2json.com/v1/api.json?rss_url=https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`
        )
        const rssData = await rssRes.json()
        
        if (rssData.items) {
          for (const item of rssData.items.slice(0, 15)) {
            if (item.link && !seen.has(item.link)) {
              seen.add(item.link)
              articles.push({
                title: item.title || '',
                link: item.link,
                snippet: item.description?.replace(/<[^>]+>/g, '').substring(0, 200) || '',
                source: item.author || 'Google News',
                date: item.pubDate || '',
                image: item.thumbnail || item.enclosure?.link || undefined
              })
            }
          }
        }
      } catch {}
    }

    // 4. Bing News RSS
    if (articles.length < 15) {
      try {
        const bingRes = await fetch(
          `https://www.bing.com/news/search?q=${encodeURIComponent(query)}&format=rss`,
          { headers: { 'User-Agent': 'Mozilla/5.0' } }
        )
        const bingText = await bingRes.text()
        
        const itemRegex = /<item[^>]*>[\s\S]*?<\/item>/gi
        const items = bingText.match(itemRegex) || []
        
        for (const item of items.slice(0, 10)) {
          const urlMatch = item.match(/<link[^>]*>([^<]+)<\/link>/i)
          const titleMatch = item.match(/<title[^>]*><!\[CDATA\[([^\]]+)\]\]><\/title>/i) || item.match(/<title[^>]*>([^<]+)<\/title>/i)
          const descMatch = item.match(/<description[^>]*><!\[CDATA\[([^\]]+)\]\]><\/description>/i) || item.match(/<description[^>]*>([^<]+)<\/description>/i)
          const pubMatch = item.match(/<pubDate[^>]*>([^<]+)<\/pubDate>/i)
          const imageMatch = item.match(/<image[^>]*url=["']([^"']+)["']/i) || item.match(/<media:content[^>]*url=["']([^"']+)["']/i) || item.match(/<enclosure[^>]*url=["']([^"']+)["']/i)
          
          if (urlMatch && titleMatch) {
            const url = urlMatch[1].trim()
            if (!seen.has(url)) {
              seen.add(url)
              articles.push({
                title: titleMatch[1].trim(),
                link: url,
                snippet: descMatch ? descMatch[1].replace(/<[^>]+>/g, '').substring(0, 200) : '',
                source: 'Bing News',
                date: pubMatch ? pubMatch[1] : '',
                image: imageMatch ? imageMatch[1] : undefined
              })
            }
          }
        }
      } catch {}
    }

    // 5. Hacker News API (for tech news)
    if (query.toLowerCase().includes('tech') || query.toLowerCase().includes('startup') || 
        query.toLowerCase().includes('ai') || query.toLowerCase().includes('software') ||
        query.toLowerCase().includes('news') || query.toLowerCase().includes('technology')) {
      try {
        const hnRes = await fetch('https://hn.algolia.com/api/v1/search?query=' + encodeURIComponent(query) + '&tags=story&hitsPerPage=15')
        const hnData = await hnRes.json()
        
        if (hnData.hits) {
          for (const hit of hnData.hits) {
            if (hit.url && !seen.has(hit.url)) {
              seen.add(hit.url)
              articles.push({
                title: hit.title || '',
                link: hit.url,
                snippet: hit._highlightResult?.text?.value?.replace(/<[^>]+>/g, '').substring(0, 200) || hit.story_text?.substring(0, 200) || '',
                source: 'Hacker News',
                date: hit.created_at || '',
                image: hit._highlightResult?.story_text?.value ? undefined : undefined // HN doesn't have images by default
              })
            }
          }
        }
      } catch {}
    }

    // 6. Reddit as news source
    if (articles.length < 15) {
      try {
        const redditRes = await fetch(
          `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=top&limit=15`,
          { headers: { 'User-Agent': 'Sift/1.0' } }
        )
        const redditData = await redditRes.json()
        
        if (redditData.data?.children) {
          for (const child of redditData.data.children) {
            const post = child.data
            if (post.url && !seen.has(post.url) && !post.url.includes('reddit.com')) {
              seen.add(post.url)
              const imageUrl = post.preview?.images?.[0]?.source?.url?.replace(/&amp;/g, '&')
              articles.push({
                title: post.title || '',
                link: post.url,
                snippet: post.selftext?.substring(0, 200) || `Posted on r/${post.subreddit} - ${post.score} upvotes`,
                source: `r/${post.subreddit}`,
                date: new Date(post.created_utc * 1000).toISOString(),
                image: imageUrl || undefined
              })
            }
          }
        }
      } catch {}
    }

    // Sort by date (newest first)
    articles.sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0
      const dateB = b.date ? new Date(b.date).getTime() : 0
      return dateB - dateA
    })

    return NextResponse.json({ articles: articles.slice(0, 20) })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ articles: [] }, { status: 500 })
  }
}
