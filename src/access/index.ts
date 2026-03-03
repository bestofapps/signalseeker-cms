import type { Access } from 'payload'

export const isAdmin: Access = ({ req: { user } }) => Boolean(user)

export const isPublished: Access = ({ req: { user } }) => {
  if (user) return true
  return { _status: { equals: 'published' } }
}

export const anyone: Access = () => true
