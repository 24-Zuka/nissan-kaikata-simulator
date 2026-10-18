import { cpSync, mkdirSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// These are generated static build outputs, never browser/customer storage.
const output = fileURLToPath(new URL('../dist-pitnote/', import.meta.url))
rmSync(output, { recursive: true, force: true })
mkdirSync(output, { recursive: true })
cpSync(new URL('../pitnote/', import.meta.url), output, { recursive: true })
cpSync(new URL('../dist-embed/', import.meta.url), new URL('../dist-pitnote/carplan/', import.meta.url), { recursive: true })
console.log('PITNOTE distribution prepared in dist-pitnote/')
