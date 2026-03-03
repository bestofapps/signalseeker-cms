import type { CollectionConfig } from 'payload'
import { anyone, isAdmin } from '../access'
import { slugField } from '../fields/slug'

export const Authors: CollectionConfig = {
  slug: 'authors',
  admin: {
    useAsTitle: 'name',
  },
  access: {
    read: anyone,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    slugField('name'),
    {
      name: 'bio',
      type: 'textarea',
    },
    {
      name: 'avatar',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'socialLinks',
      type: 'group',
      fields: [
        {
          name: 'twitter',
          type: 'text',
          label: 'Twitter / X Handle',
        },
        {
          name: 'linkedin',
          type: 'text',
          label: 'LinkedIn URL',
        },
        {
          name: 'website',
          type: 'text',
          label: 'Personal Website',
        },
      ],
    },
  ],
}
