import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')

  if (!url) {
    return NextResponse.json({ error: 'URL required' }, { status: 400 })
  }

  try {
    const urlObj = new URL(url)
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return NextResponse.json({ error: 'Invalid protocol' }, { status: 400 })
    }

    // Fetch the page
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    })

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch page' }, { status: 400 })
    }

    const html = await response.text()

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    let title = titleMatch ? titleMatch[1].trim() : ''
    
    // Try Open Graph title
    const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
                          html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i)
    if (ogTitleMatch) title = ogTitleMatch[1].trim()

    // Extract main content - try multiple methods
    let text = ''
    
    // Method 1: Look for article tag
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
    
    // Method 2: Look for main tag
    const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
    
    // Method 3: Look for content divs
    const contentMatch = html.match(/<div[^>]+class=["'][^"']*(?:article-content|article-body|post-content|entry-content|story-body|content)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)
    
    // Method 4: Common news article patterns
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)

    const contentArea = articleMatch?.[1] || mainMatch?.[1] || contentMatch?.[1] || bodyMatch?.[1] || html

    // Extract text from paragraphs
    const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi
    const paragraphs: string[] = []
    let match
    while ((match = pRegex.exec(contentArea)) !== null && paragraphs.length < 50) {
      let pText = match[1]
      // Remove nested tags but keep text
      pText = pText.replace(/<[^>]+>/g, ' ')
      pText = pText.replace(/\s+/g, ' ').trim()
      if (pText.length > 50) {
        paragraphs.push(pText)
      }
    }
    
    // If no good paragraphs, try getting all text content
    if (paragraphs.length < 3) {
      const allText = contentArea.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                           .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                           .replace(/<[^>]+>/g, ' ')
                           .replace(/\s+/g, ' ')
                           .trim()
      if (allText.length > 100) {
        text = allText.substring(0, 5000)
      }
    } else {
      text = paragraphs.join('\n\n')
    }

    // Extract description/summary
    const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
                      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i) ||
                      html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
    const description = descMatch ? descMatch[1].trim() : ''

    // Extract first image
    let image = ''
    
    // Try Open Graph image
    const ogImageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
                         html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
    if (ogImageMatch) image = ogImageMatch[1]
    
    // Try Twitter image
    if (!image) {
      const twitterMatch = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)
      if (twitterMatch) image = twitterMatch[1]
    }
    
    // Try first img in content
    if (!image) {
      const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i)
      if (imgMatch) {
        let imgSrc = imgMatch[1]
        if (imgSrc.startsWith('//')) imgSrc = 'https:' + imgSrc
        else if (imgSrc.startsWith('/')) imgSrc = urlObj.origin + imgSrc
        if (!imgSrc.startsWith('data:')) image = imgSrc
      }
    }

    // Extract author
    const authorMatch = html.match(/<meta[^>]+name=["']author["'][^>]+content=["']([^"']+)["']/i) ||
                       html.match(/<[^>]+class=["'][^"']*author[^"']*["'][^>]*>([^<]+)<\/[^>]+>/i)
    const author = authorMatch ? authorMatch[1].trim() : ''

    // Extract publish date
    const dateMatch = html.match(/<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i) ||
                     html.match(/<time[^>]+datetime=["']([^"']+)["']/i)
    const publishDate = dateMatch ? dateMatch[1] : ''

    // Clean up text
    text = text.substring(0, 8000)
    text = text.replace(/\n{3,}/g, '\n\n')
    text = text.trim()

    return NextResponse.json({
      title: title || 'Article',
      text: text || description || 'Full content unavailable',
      description,
      image,
      author,
      publishDate,
      url
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to process page' }, { status: 500 })
  }
}
