import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')

  if (!query) {
    return NextResponse.json({ error: 'Query required' }, { status: 400 })
  }

  const images: { title: string; link: string; thumbnail: string; source: string }[] = []
  const seen = new Set<string>()

  try {
    const encodedQuery = encodeURIComponent(query)

    // 1. Wikipedia - main topic image
    try {
      const wikiRes = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&titles=${encodedQuery}&prop=pageimages&format=json&origin=*&pithumbsize=800`,
        { headers: { 'User-Agent': 'Sift/1.0' } }
      )
      const wikiData = await wikiRes.json()
      const pages = wikiData.query?.pages || {}
      
      for (const pageId of Object.keys(pages)) {
        if (pages[pageId].thumbnail && pages[pageId].pageid > 0) {
          const url = pages[pageId].thumbnail.source
          if (!seen.has(url)) {
            seen.add(url)
            images.unshift({
              title: pages[pageId].title,
              link: `https://en.wikipedia.org/wiki/${encodeURIComponent(pages[pageId].title.replace(/ /g, '_'))}`,
              thumbnail: url,
              source: 'Wikipedia'
            })
          }
        }
      }
    } catch {}

    // 2. Wikidata - entity images
    try {
      const wikidataRes = await fetch(
        `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodedQuery}&language=en&format=json&origin=*&limit=20`,
        { headers: { 'User-Agent': 'Sift/1.0' } }
      )
      const wikidataData = await wikidataRes.json()
      
      if (wikidataData.search) {
        for (const entity of wikidataData.search.slice(0, 10)) {
          try {
            const entityRes = await fetch(
              `https://www.wikidata.org/wiki/Special:EntityData/${entity.id}.json`,
              { headers: { 'User-Agent': 'Sift/1.0' } }
            )
            const entityData = await entityRes.json()
            const claims = entityData.entities?.[entity.id]?.claims
            
            for (const prop of ['P18', 'P41', 'P109', 'P154', 'P94', 'P85']) {
              if (claims?.[prop]?.[0]?.mainsnak?.datavalue?.value) {
                const imgName = claims[prop][0].mainsnak.datavalue.value
                const thumbUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(imgName)}?width=500`
                
                if (!seen.has(thumbUrl)) {
                  seen.add(thumbUrl)
                  images.push({
                    title: entity.label || query,
                    link: `https://www.wikidata.org/wiki/${entity.id}`,
                    thumbnail: thumbUrl,
                    source: 'Wikidata'
                  })
                }
                break
              }
            }
          } catch {}
        }
      }
    } catch {}

    // 3. Wikimedia Commons search
    try {
      const commonsRes = await fetch(
        `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodedQuery}&format=json&origin=*&srnamespace=6&srlimit=50`,
        { headers: { 'User-Agent': 'Sift/1.0' } }
      )
      const commonsData = await commonsRes.json()
      
      if (commonsData.query?.search) {
        for (const item of commonsData.query.search) {
          const imgName = item.title.replace('File:', '')
          const thumbUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(imgName)}?width=400`
          
          if (!seen.has(thumbUrl)) {
            seen.add(thumbUrl)
            images.push({
              title: imgName.replace(/\.\w+$/, ''),
              link: `https://commons.wikimedia.org/wiki/${encodeURIComponent(item.title)}`,
              thumbnail: thumbUrl,
              source: 'Commons'
            })
          }
        }
      }
    } catch {}

    // 4. Wikipedia category images for related topics
    try {
      const catRes = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodedQuery}&format=json&origin=*&srlimit=10`,
        { headers: { 'User-Agent': 'Sift/1.0' } }
      )
      const catData = await catRes.json()
      
      if (catData.query?.search) {
        for (const item of catData.query.search.slice(0, 5)) {
          try {
            const imgRes = await fetch(
              `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(item.title)}&prop=pageimages&format=json&origin=*&pithumbsize=400`,
              { headers: { 'User-Agent': 'Sift/1.0' } }
            )
            const imgData = await imgRes.json()
            const pages = imgData.query?.pages || {}
            
            for (const pageId of Object.keys(pages)) {
              if (pages[pageId].thumbnail && !seen.has(pages[pageId].thumbnail.source)) {
                seen.add(pages[pageId].thumbnail.source)
                images.push({
                  title: pages[pageId].title,
                  link: `https://en.wikipedia.org/wiki/${encodeURIComponent(pages[pageId].title.replace(/ /g, '_'))}`,
                  thumbnail: pages[pageId].thumbnail.source,
                  source: 'Wikipedia'
                })
              }
            }
          } catch {}
        }
      }
    } catch {}

    // 5. Brave Search Images
    const braveKey = process.env.BRAVE_API_KEY
    if (braveKey && images.length < 20) {
      try {
        const braveRes = await fetch(
          `https://api.search.brave.com/res/v1/images/search?q=${encodedQuery}&count=50`,
          { headers: { 'X-Subscription-Token': braveKey, 'Accept': 'application/json' } }
        )
        const braveData = await braveRes.json()
        
        if (braveData.results) {
          for (const img of braveData.results) {
            const thumb = img.thumbnail?.url || img.url
            if (!seen.has(thumb)) {
              seen.add(thumb)
              images.push({
                title: img.title || query,
                link: img.url,
                thumbnail: thumb,
                source: 'Brave'
              })
            }
          }
        }
      } catch {}
    }

    // 6. SerpAPI Images
    const serpKey = process.env.SERP_API_KEY
    if (serpKey && images.length < 20) {
      try {
        const serpRes = await fetch(
          `https://api.serpdog.io/images?api_key=${serpKey}&q=${encodedQuery}&limit=50`
        )
        const serpData = await serpRes.json()
        
        if (serpData.image_results) {
          for (const img of serpData.image_results) {
            const thumb = img.thumbnail || img.source || img.image
            if (!seen.has(thumb)) {
              seen.add(thumb)
              images.push({
                title: img.title || query,
                link: img.link || img.source,
                thumbnail: thumb,
                source: 'Search'
              })
            }
          }
        }
      } catch {}
    }

    // Remove duplicates and limit
    const finalImages = images.filter((img, index, self) => 
      index === self.findIndex(t => t.thumbnail === img.thumbnail)
    ).slice(0, 50)

    return NextResponse.json({ images: finalImages })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ images: [] }, { status: 500 })
  }
}
