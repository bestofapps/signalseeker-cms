/**
 * Ghost → Payload CMS Migration Script
 *
 * Fetches all posts, authors, and tags from Ghost and creates them in Payload
 * via the REST API.
 *
 * Usage:
 *   1. Start Payload dev server: pnpm dev
 *   2. Create your admin user at http://localhost:3000/admin
 *   3. Run: npx tsx scripts/seed-from-ghost.ts
 *
 * Environment variables (optional):
 *   PAYLOAD_URL    — Payload CMS URL (default: http://localhost:3000)
 *   PAYLOAD_EMAIL  — Admin email for login
 *   PAYLOAD_PASS   — Admin password for login
 *   GHOST_URL      — Ghost CMS URL (default: https://cms.yepp-yepp.com)
 *   GHOST_KEY      — Ghost Content API key (default: da149ef5fbdf8f6acc74a9a2ed)
 */

const PAYLOAD_URL = process.env.PAYLOAD_URL || 'http://localhost:3000'
const PAYLOAD_EMAIL = process.env.PAYLOAD_EMAIL || ''
const PAYLOAD_PASS = process.env.PAYLOAD_PASS || ''

const GHOST_URL = process.env.GHOST_URL || 'https://cms.yepp-yepp.com'
const GHOST_KEY = process.env.GHOST_KEY || 'da149ef5fbdf8f6acc74a9a2ed'

// ---------------------------------------------------------------------------
// Ghost types
// ---------------------------------------------------------------------------

interface GhostAuthor {
  id: string
  name: string
  slug: string
  profile_image: string | null
  bio: string | null
  website: string | null
  twitter: string | null
  facebook: string | null
}

interface GhostTag {
  id: string
  name: string
  slug: string
  description: string | null
}

interface GhostPost {
  id: string
  title: string
  slug: string
  html: string
  feature_image: string | null
  featured: boolean
  primary_tag: GhostTag | null
  tags: GhostTag[]
  primary_author: GhostAuthor | null
  authors: GhostAuthor[]
  published_at: string
  updated_at: string
  reading_time: number
  excerpt: string
  custom_excerpt: string | null
  meta_title: string | null
  meta_description: string | null
  og_image: string | null
}

// ---------------------------------------------------------------------------
// Payload helpers
// ---------------------------------------------------------------------------

let payloadToken = ''

async function payloadLogin(): Promise<void> {
  if (!PAYLOAD_EMAIL || !PAYLOAD_PASS) {
    console.error('\n❌ Please set PAYLOAD_EMAIL and PAYLOAD_PASS environment variables.')
    console.error('   Example: PAYLOAD_EMAIL=admin@example.com PAYLOAD_PASS=secret npx tsx scripts/seed-from-ghost.ts\n')
    process.exit(1)
  }

  const res = await fetch(`${PAYLOAD_URL}/api/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: PAYLOAD_EMAIL, password: PAYLOAD_PASS }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Login failed (${res.status}): ${text}`)
  }

  const data = (await res.json()) as { token: string }
  payloadToken = data.token
  console.log('✓ Logged in to Payload CMS')
}

async function payloadPost(collection: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`${PAYLOAD_URL}/api/${collection}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `JWT ${payloadToken}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`POST /api/${collection} failed (${res.status}): ${text}`)
  }

  return (await res.json()) as Record<string, unknown>
}

async function payloadPatch(collection: string, id: number, body: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${PAYLOAD_URL}/api/${collection}/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `JWT ${payloadToken}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`PATCH /api/${collection}/${id} failed (${res.status}): ${text}`)
  }
}

async function payloadUpdateGlobal(slug: string, body: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${PAYLOAD_URL}/api/globals/${slug}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `JWT ${payloadToken}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`POST /api/globals/${slug} failed (${res.status}): ${text}`)
  }
}

// ---------------------------------------------------------------------------
// Ghost fetchers
// ---------------------------------------------------------------------------

async function fetchGhostPosts(): Promise<GhostPost[]> {
  const url = `${GHOST_URL}/ghost/api/content/posts/?key=${GHOST_KEY}&limit=all&include=authors,tags&formats=html`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Ghost API error: ${res.status}`)
  const data = (await res.json()) as { posts: GhostPost[] }
  return data.posts
}

async function fetchGhostTags(): Promise<GhostTag[]> {
  const url = `${GHOST_URL}/ghost/api/content/tags/?key=${GHOST_KEY}&limit=all&filter=visibility:public`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Ghost tags API error: ${res.status}`)
  const data = (await res.json()) as { tags: GhostTag[] }
  return data.tags
}

// ---------------------------------------------------------------------------
// HTML → Lexical converter (simple paragraph-based conversion)
//
// Ghost stores content as HTML. Payload uses Lexical JSON.
// This converts each HTML block-level element into Lexical nodes.
// ---------------------------------------------------------------------------

function htmlToLexical(html: string): Record<string, unknown> {
  // Split HTML into block-level chunks
  const blocks: string[] = []
  const blockRegex = /<(p|h[1-6]|blockquote|ul|ol|hr|figure|div|table)[^>]*>([\s\S]*?)<\/\1>|<hr\s*\/?>/gi
  let match: RegExpExecArray | null

  while ((match = blockRegex.exec(html)) !== null) {
    blocks.push(match[0])
  }

  // If no blocks matched, wrap whole thing as paragraph
  if (blocks.length === 0 && html.trim()) {
    blocks.push(`<p>${html}</p>`)
  }

  const children: Record<string, unknown>[] = blocks.map((block) => {
    // Headings
    const headingMatch = block.match(/^<(h[1-6])[^>]*>([\s\S]*?)<\/\1>$/i)
    if (headingMatch) {
      return {
        type: 'heading',
        tag: headingMatch[1].toLowerCase(),
        children: parseInline(headingMatch[2]),
        direction: 'ltr',
        format: '',
        indent: 0,
        version: 1,
      }
    }

    // Horizontal rule
    if (/^<hr/i.test(block)) {
      return {
        type: 'horizontalrule',
        version: 1,
      }
    }

    // Blockquote
    const bqMatch = block.match(/^<blockquote[^>]*>([\s\S]*?)<\/blockquote>$/i)
    if (bqMatch) {
      return {
        type: 'quote',
        children: parseInline(stripTags(bqMatch[1]).trim()),
        direction: 'ltr',
        format: '',
        indent: 0,
        version: 1,
      }
    }

    // Unordered list
    const ulMatch = block.match(/^<ul[^>]*>([\s\S]*?)<\/ul>$/i)
    if (ulMatch) {
      return {
        type: 'list',
        listType: 'bullet',
        tag: 'ul',
        children: parseListItems(ulMatch[1]),
        direction: 'ltr',
        format: '',
        indent: 0,
        start: 1,
        version: 1,
      }
    }

    // Ordered list
    const olMatch = block.match(/^<ol[^>]*>([\s\S]*?)<\/ol>$/i)
    if (olMatch) {
      return {
        type: 'list',
        listType: 'number',
        tag: 'ol',
        children: parseListItems(olMatch[1]),
        direction: 'ltr',
        format: '',
        indent: 0,
        start: 1,
        version: 1,
      }
    }

    // Default: paragraph
    const pMatch = block.match(/^<p[^>]*>([\s\S]*?)<\/p>$/i)
    const inner = pMatch ? pMatch[1] : stripTags(block)

    return {
      type: 'paragraph',
      children: parseInline(inner),
      direction: 'ltr',
      format: '',
      indent: 0,
      textFormat: 0,
      version: 1,
    }
  })

  return {
    root: {
      type: 'root',
      children,
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1,
    },
  }
}

function parseInline(html: string): Record<string, unknown>[] {
  if (!html || !html.trim()) {
    return [{ type: 'text', text: '', format: 0, detail: 0, mode: 'normal', style: '', version: 1 }]
  }

  const nodes: Record<string, unknown>[] = []
  // Process inline HTML: split on tags, handle bold/italic/links/code
  const inlineRegex = /<(strong|b|em|i|code|a|u|s|del|sub|sup)(\s[^>]*)?>|<\/(strong|b|em|i|code|a|u|s|del|sub|sup)>|<br\s*\/?>|([^<]+)/gi
  let currentFormat = 0
  let currentLink: string | null = null
  let inlineMatch: RegExpExecArray | null

  while ((inlineMatch = inlineRegex.exec(html)) !== null) {
    const [full, openTag, attrs, closeTag, text] = inlineMatch

    if (text) {
      const decoded = decodeHtmlEntities(text)
      if (decoded) {
        if (currentLink) {
          nodes.push({
            type: 'link',
            fields: { url: currentLink, newTab: false, linkType: 'custom' },
            children: [{ type: 'text', text: decoded, format: currentFormat, detail: 0, mode: 'normal', style: '', version: 1 }],
            direction: 'ltr',
            format: '',
            indent: 0,
            version: 3,
          })
        } else {
          nodes.push({ type: 'text', text: decoded, format: currentFormat, detail: 0, mode: 'normal', style: '', version: 1 })
        }
      }
    } else if (full === '<br>' || full === '<br/>' || full === '<br />') {
      nodes.push({ type: 'linebreak', version: 1 })
    } else if (openTag) {
      const tag = openTag.toLowerCase()
      if (tag === 'strong' || tag === 'b') currentFormat |= 1
      else if (tag === 'em' || tag === 'i') currentFormat |= 2
      else if (tag === 's' || tag === 'del') currentFormat |= 4
      else if (tag === 'u') currentFormat |= 8
      else if (tag === 'code') currentFormat |= 16
      else if (tag === 'sub') currentFormat |= 32
      else if (tag === 'sup') currentFormat |= 64
      else if (tag === 'a') {
        const hrefMatch = attrs?.match(/href="([^"]*)"/)
        currentLink = hrefMatch ? hrefMatch[1] : '#'
      }
    } else if (closeTag) {
      const tag = closeTag.toLowerCase()
      if (tag === 'strong' || tag === 'b') currentFormat &= ~1
      else if (tag === 'em' || tag === 'i') currentFormat &= ~2
      else if (tag === 's' || tag === 'del') currentFormat &= ~4
      else if (tag === 'u') currentFormat &= ~8
      else if (tag === 'code') currentFormat &= ~16
      else if (tag === 'sub') currentFormat &= ~32
      else if (tag === 'sup') currentFormat &= ~64
      else if (tag === 'a') currentLink = null
    }
  }

  if (nodes.length === 0) {
    nodes.push({ type: 'text', text: '', format: 0, detail: 0, mode: 'normal', style: '', version: 1 })
  }

  return nodes
}

function parseListItems(html: string): Record<string, unknown>[] {
  const items: Record<string, unknown>[] = []
  const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi
  let match: RegExpExecArray | null

  while ((match = liRegex.exec(html)) !== null) {
    items.push({
      type: 'listitem',
      children: parseInline(match[1]),
      direction: 'ltr',
      format: '',
      indent: 0,
      value: items.length + 1,
      version: 1,
    })
  }

  return items
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '')
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
}

// ---------------------------------------------------------------------------
// Main migration
// ---------------------------------------------------------------------------

async function main() {
  console.log('\n🚀 Ghost → Payload CMS Migration\n')
  console.log(`   Ghost: ${GHOST_URL}`)
  console.log(`   Payload: ${PAYLOAD_URL}\n`)

  // 1. Login to Payload
  await payloadLogin()

  // 2. Fetch Ghost data
  console.log('\n📥 Fetching data from Ghost...')
  const [ghostPosts, ghostTags] = await Promise.all([fetchGhostPosts(), fetchGhostTags()])
  console.log(`   Found ${ghostPosts.length} posts, ${ghostTags.length} tags`)

  // 3. Create categories (from Ghost tags)
  console.log('\n📁 Creating categories...')
  const categoryMap = new Map<string, number>() // ghostSlug → payloadId

  for (const tag of ghostTags) {
    try {
      const result = await payloadPost('categories', {
        name: tag.name,
        slug: tag.slug,
        description: tag.description || undefined,
      })
      const doc = (result as { doc?: { id: number } }).doc || result
      const id = (doc as { id: number }).id
      categoryMap.set(tag.slug, id)
      console.log(`   ✓ Category: ${tag.name} (id: ${id})`)
    } catch (e) {
      console.log(`   ⚠ Category "${tag.name}" may already exist: ${(e as Error).message.slice(0, 100)}`)
    }
  }

  // 4. Create author (Julian Vane — the single Ghost author)
  console.log('\n👤 Creating author...')
  let authorId: number | null = null

  const ghostAuthor = ghostPosts[0]?.primary_author
  if (ghostAuthor) {
    try {
      const result = await payloadPost('authors', {
        name: ghostAuthor.name,
        slug: ghostAuthor.slug,
        bio: ghostAuthor.bio || undefined,
        socialLinks: {
          twitter: ghostAuthor.twitter || undefined,
          website: ghostAuthor.website || undefined,
        },
      })
      const doc = (result as { doc?: { id: number } }).doc || result
      authorId = (doc as { id: number }).id
      console.log(`   ✓ Author: ${ghostAuthor.name} (id: ${authorId})`)
    } catch (e) {
      console.log(`   ⚠ Author may already exist: ${(e as Error).message.slice(0, 100)}`)
    }
  }

  // 5. Create posts
  console.log('\n📝 Creating posts...')

  for (const post of ghostPosts) {
    try {
      // Map Ghost tags to Payload category IDs
      const categoryIds = post.tags
        .map((t) => categoryMap.get(t.slug))
        .filter((id): id is number => id !== undefined)

      // Convert HTML to Lexical
      const lexicalContent = htmlToLexical(post.html)

      const postData: Record<string, unknown> = {
        title: post.title,
        slug: post.slug,
        content: lexicalContent,
        excerpt: post.custom_excerpt || post.excerpt?.slice(0, 300) || undefined,
        featured: post.featured,
        publishedAt: post.published_at,
        readingTime: post.reading_time,
        _status: 'published',
        ...(authorId ? { author: authorId } : {}),
        ...(categoryIds.length > 0 ? { categories: categoryIds } : {}),
        // SEO fields from Ghost
        meta: {
          title: post.meta_title || `${post.title} | The Signal Seeker`,
          description: post.meta_description || post.custom_excerpt || post.excerpt?.slice(0, 160) || undefined,
        },
      }

      const result = await payloadPost('posts', postData)
      const doc = (result as { doc?: { id: number } }).doc || result
      const id = (doc as { id: number }).id
      console.log(`   ✓ Post: "${post.title}" (id: ${id})`)
    } catch (e) {
      console.error(`   ✗ Failed to create "${post.title}": ${(e as Error).message.slice(0, 200)}`)
    }
  }

  // 6. Seed header navigation
  console.log('\n🧭 Seeding header navigation...')
  try {
    const navItems = ghostTags.map((tag) => ({
      label: tag.name,
      link: `/tag/${tag.slug}`,
    }))
    navItems.push({ label: 'About', link: '/about' })

    await payloadUpdateGlobal('header', { navItems })
    console.log(`   ✓ Header: ${navItems.length} nav items`)
  } catch (e) {
    console.error(`   ✗ Header update failed: ${(e as Error).message.slice(0, 200)}`)
  }

  // 7. Seed footer
  console.log('\n🦶 Seeding footer...')
  try {
    await payloadUpdateGlobal('footer', {
      copyright: `© ${new Date().getFullYear()} The Signal Seeker. All rights reserved.`,
      socialLinks: [
        { platform: 'twitter', url: '#' },
        { platform: 'facebook', url: '#' },
        { platform: 'linkedin', url: '#' },
      ],
      navGroups: [
        {
          title: 'Explore',
          links: ghostTags.map((tag) => ({ label: tag.name, url: `/tag/${tag.slug}` })),
        },
        {
          title: 'Company',
          links: [
            { label: 'About', url: '/about' },
            { label: 'Contact', url: '/contact' },
            { label: 'FAQs', url: '/faqs' },
          ],
        },
        {
          title: 'Legal',
          links: [
            { label: 'Privacy Policy', url: '/privacy' },
            { label: 'Terms of Service', url: '/terms' },
          ],
        },
      ],
    })
    console.log('   ✓ Footer seeded')
  } catch (e) {
    console.error(`   ✗ Footer update failed: ${(e as Error).message.slice(0, 200)}`)
  }

  console.log('\n✅ Migration complete!\n')
  console.log('Note: Feature images were not migrated (they are external URLs on Ghost/Unsplash).')
  console.log('You can re-upload them via the Payload admin panel or keep using the external URLs.\n')
}

main().catch((err) => {
  console.error('\n💥 Migration failed:', err)
  process.exit(1)
})
