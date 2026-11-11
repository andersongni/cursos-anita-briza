import { describe, expect, it } from 'vitest'
import { setSiteFavicon } from './favicon'

describe('setSiteFavicon (node)', () => {
  it('no-op sem document', () => {
    expect(() => setSiteFavicon('/favicon.png')).not.toThrow()
  })
})
