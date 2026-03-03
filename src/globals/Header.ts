import type { GlobalConfig } from 'payload'
import { anyone, isAdmin } from '../access'

export const Header: GlobalConfig = {
  slug: 'header',
  access: {
    read: anyone,
    update: isAdmin,
  },
  fields: [
    {
      name: 'navItems',
      type: 'array',
      fields: [
        {
          name: 'label',
          type: 'text',
          required: true,
        },
        {
          name: 'link',
          type: 'text',
          required: true,
        },
      ],
    },
  ],
}
