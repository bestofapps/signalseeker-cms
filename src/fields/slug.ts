import type { Field } from 'payload'

const formatSlug = (val: string): string =>
  val
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

export const slugField = (sourceField: string = 'title'): Field => ({
  name: 'slug',
  type: 'text',
  required: true,
  unique: true,
  admin: {
    position: 'sidebar',
  },
  hooks: {
    beforeValidate: [
      ({ value, siblingData }) => {
        if (typeof value === 'string' && value.length > 0) {
          return formatSlug(value)
        }
        const source = siblingData?.[sourceField]
        if (typeof source === 'string' && source.length > 0) {
          return formatSlug(source)
        }
        return value
      },
    ],
  },
})
