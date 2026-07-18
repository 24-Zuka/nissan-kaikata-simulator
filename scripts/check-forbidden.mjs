import { readFile, readdir } from 'node:fs/promises'
import { extname, join } from 'node:path'

const roots = ['src']
const extensions = new Set(['.ts', '.tsx', '.css', '.html'])
const forbidden = [
  ['タイヤ', '交換'].join(''),
  ['絶対', 'おすすめ'].join(''),
  ['これ', '一択'].join(''),
  ['必ず', '得'].join(''),
]

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== 'test') files.push(...(await collectFiles(path)))
    } else if (extensions.has(extname(entry.name))) {
      files.push(path)
    }
  }

  return files
}

const files = (await Promise.all(roots.map(collectFiles))).flat()
const violations = []

for (const file of files) {
  const content = await readFile(file, 'utf8')
  for (const term of forbidden) {
    if (content.includes(term)) violations.push(`${file}: ${term}`)
  }
}

if (violations.length > 0) {
  console.error(violations.join('\n'))
  process.exit(1)
}

console.log('禁止表記は表示コードにありません。')
