/**
 * Ghost → Payload CMS Migration Script
 *
 * Fetches all posts, authors, and tags from Ghost and creates them in Payload
 * via the REST API. Uses Payload's official convertMarkdownToLexical for
 * rich text conversion.
 *
 * Usage:
 *   1. Deploy the CMS (or start dev server: pnpm dev)
 *   2. Create your admin user at /admin
 *   3. Run: npx tsx scripts/seed-from-ghost.ts
 *
 * Environment variables (optional):
 *   PAYLOAD_URL    — Payload CMS URL (default: http://localhost:3000)
 *   PAYLOAD_EMAIL  — Admin email for login
 *   PAYLOAD_PASS   — Admin password for login
 *   GHOST_URL      — Ghost CMS URL (default: https://cms.yepp-yepp.com)
 *   GHOST_KEY      — Ghost Content API key (default: da149ef5fbdf8f6acc74a9a2ed)
 */

import {
  convertMarkdownToLexical,
  editorConfigFactory,
  defaultEditorFeatures,
} from '@payloadcms/richtext-lexical'

const PAYLOAD_URL = process.env.PAYLOAD_URL || 'https://signalseeker-cms.at2010.workers.dev/'
const PAYLOAD_EMAIL = 'g.siemer@cliqdigital.com'
const PAYLOAD_PASS = 'qwq3ubp!hdm_cvb3VRF'

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
// HTML → Markdown converter
// ---------------------------------------------------------------------------

function htmlToMarkdown(html: string): string {
  let md = html

  // Headings
  md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_, c) => `# ${stripTags(c).trim()}\n\n`)
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_, c) => `## ${stripTags(c).trim()}\n\n`)
  md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_, c) => `### ${stripTags(c).trim()}\n\n`)
  md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, (_, c) => `#### ${stripTags(c).trim()}\n\n`)
  md = md.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, (_, c) => `##### ${stripTags(c).trim()}\n\n`)
  md = md.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, (_, c) => `###### ${stripTags(c).trim()}\n\n`)

  // Horizontal rules
  md = md.replace(/<hr\s*\/?>/gi, '\n---\n\n')

  // Blockquotes
  md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, c) => {
    const text = stripTags(c).trim()
    return text.split('\n').map((line: string) => `> ${line}`).join('\n') + '\n\n'
  })

  // Bold / strong
  md = md.replace(/<(strong|b)>([\s\S]*?)<\/\1>/gi, '**$2**')

  // Italic / em
  md = md.replace(/<(em|i)>([\s\S]*?)<\/\1>/gi, '*$2*')

  // Strikethrough
  md = md.replace(/<(s|del)>([\s\S]*?)<\/\1>/gi, '~~$2~~')

  // Code inline
  md = md.replace(/<code>([\s\S]*?)<\/code>/gi, '`$1`')

  // Links
  md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')

  // Images
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, '![$2]($1)')
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*\/?>/gi, '![]($1)')

  // Lists — unordered
  md = md.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, items) => {
    return items.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_: string, content: string) => {
      return `- ${convertInline(content).trim()}\n`
    }) + '\n'
  })

  // Lists — ordered
  md = md.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, items) => {
    let i = 0
    return items.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_: string, content: string) => {
      i++
      return `${i}. ${convertInline(content).trim()}\n`
    }) + '\n'
  })

  // Figures with images
  md = md.replace(/<figure[^>]*>[\s\S]*?<img[^>]*src="([^"]*)"[^>]*\/?>([\s\S]*?)<\/figure>/gi, '![]($1)\n\n')

  // Paragraphs
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, c) => `${convertInline(c).trim()}\n\n`)

  // Line breaks
  md = md.replace(/<br\s*\/?>/gi, '\n')

  // Strip remaining tags
  md = md.replace(/<\/?[^>]+>/g, '')

  // Decode HTML entities
  md = decodeEntities(md)

  // Clean up excess whitespace
  md = md.replace(/\n{3,}/g, '\n\n').trim()

  return md
}

function convertInline(html: string): string {
  let text = html
  text = text.replace(/<(strong|b)>([\s\S]*?)<\/\1>/gi, '**$2**')
  text = text.replace(/<(em|i)>([\s\S]*?)<\/\1>/gi, '*$2*')
  text = text.replace(/<(s|del)>([\s\S]*?)<\/\1>/gi, '~~$2~~')
  text = text.replace(/<code>([\s\S]*?)<\/code>/gi, '`$1`')
  text = text.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
  text = text.replace(/<br\s*\/?>/gi, '\n')
  text = text.replace(/<\/?[^>]+>/g, '')
  return text
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '')
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
}

// ---------------------------------------------------------------------------
// Lexical converter — uses Payload's official markdown → Lexical
// ---------------------------------------------------------------------------

let _editorConfig: Awaited<ReturnType<typeof editorConfigFactory.fromFeatures>> | null = null

async function getEditorConfig() {
  if (!_editorConfig) {
    _editorConfig = await editorConfigFactory.fromFeatures({
      features: defaultEditorFeatures,
      config: {
        collections: [],
        globals: [],
        localization: false,
      } as any,
    })
  }
  return _editorConfig
}

async function markdownToLexical(markdown: string): Promise<Record<string, unknown>> {
  const editorConfig = await getEditorConfig()
  return convertMarkdownToLexical({ editorConfig, markdown })
}

async function htmlToLexical(html: string): Promise<Record<string, unknown>> {
  const markdown = htmlToMarkdown(html)
  return markdownToLexical(markdown)
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
  const categoryMap = new Map<string, number>()

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

  // 4. Create author
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
      const categoryIds = post.tags
        .map((t) => categoryMap.get(t.slug))
        .filter((id): id is number => id !== undefined)

      // Convert Ghost HTML → Markdown → Lexical JSON
      const lexicalContent = await htmlToLexical(post.html)

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

  // 8. Create static pages
  console.log('\n📄 Creating static pages...')

  const staticPages = [
    {
      title: 'About',
      slug: 'about',
      meta: {
        title: 'About | The Signal Seeker',
        description: 'Learn about The Signal Seeker — gear reviews, digital nomad tips, and travel tech insights for remote workers on the move.',
      },
      layout: [
        {
          blockType: 'content',
          richText: await markdownToLexical(
            'Welcome to The Signal Seeker — your go-to resource for navigating the digital nomad lifestyle with the right gear, tech, and mindset.\n\n' +
            'Born from a shared passion for remote work and exploration, we believe that location independence is more than just a trend; it\'s a way of life. Whether you\'re setting up a mobile office in Bali, testing the latest portable monitor in Lisbon, or finding the best coworking space in Medellín — we\'ve been there.\n\n' +
            '## Our Mission\n\n' +
            'We cut through the noise to deliver honest gear reviews, actionable digital nomad tips, and travel tech insights that actually matter. No fluff, no sponsored rankings — just real-world testing by people who live this life every day.\n\n' +
            '> The best office view is the one you choose yourself.\n\n' +
            '## Who We Are\n\n' +
            'We are a collective of writers, remote workers, and tech enthusiasts who have traded cubicles for coffee shops worldwide. Every article, review, and guide on The Signal Seeker is rooted in genuine, first-hand experience from the road.'
          ),
        },
      ],
    },
    {
      title: 'Contact',
      slug: 'contact',
      meta: {
        title: 'Contact | The Signal Seeker',
        description: 'Get in touch with The Signal Seeker team — questions, press inquiries, or collaboration ideas.',
      },
      layout: [
        {
          blockType: 'content',
          richText: await markdownToLexical(
            'Have a question, a press inquiry, or a collaboration idea? We\'d love to hear from you. The best way to reach us is via email.\n\n' +
            '## Email Us\n\n' +
            '[hello@thesignalseeker.com](mailto:hello@thesignalseeker.com)\n\n' +
            '## Press Inquiries\n\n' +
            '[press@thesignalseeker.com](mailto:press@thesignalseeker.com)'
          ),
        },
      ],
    },
    {
      title: 'Terms of Service',
      slug: 'terms',
      meta: {
        title: 'Terms of Service | The Signal Seeker',
        description: 'Terms of service for The Signal Seeker website and platform.',
      },
      layout: [
        {
          blockType: 'content',
          richText: await markdownToLexical(
            'Welcome to The Signal Seeker. These terms of service outline the rules and regulations for the use of our Website and Platform. By accessing this website we assume you accept these terms of service. Do not continue to use The Signal Seeker if you do not agree to take all of the terms and conditions stated on this page.\n\n' +
            '## 1. License\n\n' +
            'Unless otherwise stated, The Signal Seeker and/or its licensors own the intellectual property rights for all material on The Signal Seeker. All intellectual property rights are reserved. You may access this from The Signal Seeker for your own personal use subjected to restrictions set in these terms and conditions.\n\n' +
            '## 2. Restrictions\n\n' +
            'You are specifically restricted from all of the following:\n\n' +
            '- Publishing any Website material in any other media without proper attribution.\n' +
            '- Selling, sublicensing and/or otherwise commercializing any Website material.\n' +
            '- Using this Website in any way that is or may be damaging to this Website.\n' +
            '- Using this Website in any way that impacts user access to this Website.\n\n' +
            '## 3. User Content\n\n' +
            'In these Website Standard Terms and Conditions, "Your Content" shall mean any audio, video text, images or other material you choose to display on this Website. By displaying Your Content, you grant The Signal Seeker a non-exclusive, worldwide irrevocable, sub licensable license to use, reproduce, adapt, publish, translate and distribute it in any and all media.\n\n' +
            '## 4. No Warranties\n\n' +
            'This Website is provided "as is," with all faults, and The Signal Seeker express no representations or warranties, of any kind related to this Website or the materials contained on this Website. Information provided on destinations is for general informational purposes only.\n\n' +
            '## 5. Governing Law & Jurisdiction\n\n' +
            'These Terms will be governed by and interpreted in accordance with the laws of the applicable jurisdiction, and you submit to the non-exclusive jurisdiction of the state and federal courts located in us for the resolution of any disputes.'
          ),
        },
      ],
    },
    {
      title: 'Privacy Policy',
      slug: 'privacy',
      meta: {
        title: 'Privacy Policy | The Signal Seeker',
        description: 'Privacy policy for The Signal Seeker — how we collect, use, and protect your data.',
      },
      layout: [
        {
          blockType: 'content',
          richText: await markdownToLexical(
            'At The Signal Seeker, we respect your privacy and are committed to protecting the personal information you share with us. This Privacy Policy outlines how our application collects, uses, and safeguards your data.\n\n' +
            '## 1. Information We Collect\n\n' +
            'We may collect several types of information from and about users of our Website, including:\n\n' +
            '- **Personal Data:** Information by which you may be personally identified, such as name and e-mail address.\n' +
            '- **Usage Details:** Details of your visits to our Website, including traffic data, location data, logs, and other communication data depending on the resources that you access on the Website.\n\n' +
            '## 2. How We Use Your Information\n\n' +
            'We use information that we collect about you or that you provide to us, including any personal information:\n\n' +
            '- To present our Website and its contents to you.\n' +
            '- To provide you with information, products, or services that you request from us.\n' +
            '- To fulfill any other purpose for which you provide it.\n' +
            '- To notify you about changes to our Website or any products or services we offer or provide though it.\n\n' +
            '## 3. Disclosure of Your Information\n\n' +
            'We do not sell, trade, or otherwise transfer to outside parties your Personally Identifiable Information unless we provide users with advance notice. This does not include website hosting partners and other parties who assist us in operating our website, conducting our business, or serving our users, so long as those parties agree to keep this information confidential.\n\n' +
            '## 4. Your Data Rights\n\n' +
            'Depending on your location, you may have the right to request access to, correction of, or deletion of your personal data. To exercise these rights, please contact us at our provided support email.\n\n' +
            '## 5. Contact Information\n\n' +
            'To ask questions or comment about this privacy policy and our privacy practices, contact us via our [Contact Page](/contact).'
          ),
        },
      ],
    },
    {
      title: 'FAQs',
      slug: 'faqs',
      meta: {
        title: 'FAQs | The Signal Seeker',
        description: 'Frequently asked questions about The Signal Seeker — gear reviews, guest posts, and how we work.',
      },
      layout: [
        {
          blockType: 'faq',
          items: [
            {
              question: 'How do you test the gear you review?',
              answer: 'Every product we review is tested in real-world conditions — on flights, in coworking spaces, at cafes, and in Airbnbs around the world. We use each item for at least two weeks before writing about it, so our reviews reflect genuine long-term use, not just unboxing impressions.',
            },
            {
              question: 'Do you accept sponsored content?',
              answer: 'We occasionally partner with brands we genuinely use and trust. Any sponsored content is always clearly disclosed. We never let partnerships influence our editorial opinion — if a product doesn\'t meet our standards, we won\'t recommend it regardless of sponsorship.',
            },
            {
              question: 'Can I contribute a guest post?',
              answer: 'We\'re always looking for experienced digital nomads and remote workers with unique stories and insights. If you have a compelling pitch — a gear comparison, a location guide, or a workflow tip — reach out via our Contact page with a brief outline and writing samples.',
            },
            {
              question: 'How often do you publish new content?',
              answer: 'We publish new articles weekly, with a mix of gear reviews, digital nomad guides, and travel tech deep dives. Subscribe to stay updated — we focus on quality over quantity, so every piece is thoroughly researched and field-tested.',
            },
          ],
        },
      ],
    },
  ]

  for (const page of staticPages) {
    try {
      const result = await payloadPost('pages', {
        ...page,
        _status: 'published',
      })
      const doc = (result as { doc?: { id: number } }).doc || result
      const id = (doc as { id: number }).id
      console.log(`   ✓ Page: "${page.title}" (id: ${id})`)
    } catch (e) {
      console.error(`   ✗ Failed to create page "${page.title}": ${(e as Error).message.slice(0, 200)}`)
    }
  }

  console.log('\n✅ Migration complete!\n')
  console.log('Note: Feature images were not migrated (they are external URLs on Ghost/Unsplash).')
  console.log('You can re-upload them via the Payload admin panel or keep using the external URLs.\n')
}

main().catch((err) => {
  console.error('\n💥 Migration failed:', err)
  process.exit(1)
})
