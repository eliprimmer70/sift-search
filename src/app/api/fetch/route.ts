import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')

  if (!url) {
    return NextResponse.json({ error: 'URL required' }, { status: 400 })
  }

  try {
    // Validate URL
    const urlObj = new URL(url)
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return NextResponse.json({ error: 'Invalid protocol' }, { status: 400 })
    }

    // Fetch the page
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SiftPreview/1.0)',
        'Accept': 'text/html,application/xhtml+xml'
      }
    })

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch page' }, { status: 400 })
    }

    const html = await response.text()

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    const title = titleMatch ? titleMatch[1].trim() : 'Untitled'

    // Extract meta description
    const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
                      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i)
    const metaDesc = descMatch ? descMatch[1].trim() : ''

    // Extract main content using simple heuristics
    let text = ''
    
    // Try to find article or main content
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
    const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
    const contentMatch = html.match(/<div[^>]+class=["'][^"']*(?:content|article|post|entry|body)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)
    
    const contentArea = articleMatch?.[1] || mainMatch?.[1] || contentMatch?.[1] || html

    // Extract text from paragraphs
    const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi
    const paragraphs: string[] = []
    let match
    while ((match = pRegex.exec(contentArea)) !== null && paragraphs.length < 20) {
      const pText = match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      if (pText.length > 30) {
        paragraphs.push(pText)
      }
    }
    text = paragraphs.join('\n\n')

    // Fallback to meta description if no paragraphs found
    if (!text && metaDesc) {
      text = metaDesc
    }

    // Extract first image
    let image = ''
    const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i)
    if (imgMatch) {
      let imgSrc = imgMatch[1]
      // Handle relative URLs
      if (imgSrc.startsWith('//')) {
        imgSrc = 'https:' + imgSrc
      } else if (imgSrc.startsWith('/')) {
        imgSrc = urlObj.origin + imgSrc
      }
      image = imgSrc
    }

    // Clean up text
    text = text.substring(0, 2000)

    return NextResponse.json({
      title,
      text,
      image,
      url
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to process page' }, { status: 500 })
  }
}
