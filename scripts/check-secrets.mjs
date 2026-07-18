import { readFile, readdir } from 'node:fs/promises'
import { extname, join } from 'node:path'

const roots = ['src', 'api', 'server', 'public', 'dist']
const rootFiles = ['vercel.json', 'README.md', 'package.json', 'index.html']
const extensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.css', '.html', '.json', '.svg'])
const patterns = [
  { name: 'OpenAI形式のキー', pattern: /sk-[A-Za-z0-9_-]{20,}/g },
  { name: '秘密鍵', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { name: 'Bearerトークン', pattern: /Bearer\s+[A-Za-z0-9._-]{16,}/gi },
  {
    name: 'ハードコードされた機密値',
    pattern: /(?:API_KEY|AUTH_SECRET|ACCESS_TOKEN|REDIS_REST_TOKEN)\s*[=:]\s*["'][^"'\s]{12,}["']/gi,
  },
  { name: '固定パスワードの直書き', pattern: /["']1206["']/g },
]

async function collect(directory) {
  try {
    const entries = await readdir(directory, { withFileTypes: true })
    const files = []
    for (const entry of entries) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) files.push(...(await collect(path)))
      else if (extensions.has(extname(entry.name))) files.push(path)
    }
    return files
  } catch {
    return []
  }
}

const files = [
  ...(await Promise.all(roots.map(collect))).flat(),
  ...rootFiles,
]
const violations = []

for (const file of files) {
  const content = await readFile(file, 'utf8')
  for (const { name, pattern } of patterns) {
    pattern.lastIndex = 0
    if (pattern.test(content)) violations.push(`${file}: ${name}`)
  }
}

if (violations.length > 0) {
  console.error(violations.join('\n'))
  process.exit(1)
}

console.log('ソースとビルド成果物に機密値の直書きはありません。')
