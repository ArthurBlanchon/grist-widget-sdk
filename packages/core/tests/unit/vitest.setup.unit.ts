import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'

import { resetGristForTests } from '../../src/sdk/use-grist'

afterEach(() => {
  resetGristForTests()
})
