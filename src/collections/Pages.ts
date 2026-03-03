import type { CollectionConfig } from 'payload'
import { isAdmin, isPublished } from '../access'
import { slugField } from '../fields/slug'

export const Pages: CollectionConfig = {
  slug: 'pages',
  admin: {
    useAsTitle: 'title',
  },
  access: {
    read: isPublished,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  versions: {
    drafts: true,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    slugField('title'),
    {
      name: 'layout',
      type: 'blocks',
      blocks: [
        {
          slug: 'content',
          fields: [
            {
              name: 'richText',
              type: 'richText',
            },
          ],
        },
        {
          slug: 'faq',
          fields: [
            {
              name: 'items',
              type: 'array',
              fields: [
                {
                  name: 'question',
                  type: 'text',
                  required: true,
                },
                {
                  name: 'answer',
                  type: 'textarea',
                  required: true,
                },
              ],
            },
          ],
        },
        {
          slug: 'cta',
          fields: [
            {
              name: 'heading',
              type: 'text',
              required: true,
            },
            {
              name: 'description',
              type: 'textarea',
            },
            {
              name: 'link',
              type: 'group',
              fields: [
                {
                  name: 'label',
                  type: 'text',
                  required: true,
                },
                {
                  name: 'url',
                  type: 'text',
                  required: true,
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}
