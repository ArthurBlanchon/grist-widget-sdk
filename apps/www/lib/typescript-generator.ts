import { createGenerator } from "fumadocs-typescript"

// Shared ts-morph program for every `<AutoTypeTable>` in the docs -- created
// once per server process rather than per MDX page, since building the
// TypeScript program is the expensive part.
export const typeTableGenerator = createGenerator()
