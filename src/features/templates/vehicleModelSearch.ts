// Search labels only: catalogue rows, grade IDs and stored comparisons stay unchanged.
const modelAliases: Record<string, string[]> = {
  'デイズ': ['dayz'],
  'ルークス': ['roox'],
  'クリッパーリオ': ['clipper rio'],
  'ノート': ['note'],
  'ノート オーラ': ['note aura', 'aura'],
  'セレナ': ['serena'],
  'エルグランド': ['elgrand'],
  'キックス': ['kicks'],
  'エクストレイル': ['x-trail'],
  '日産アリア': ['ariya', 'aria', 'アリヤ'],
  'ムラーノ': ['murano'],
}

function normalize(value: string): string {
  return value.normalize('NFKC').toLowerCase()
    .replace(/[ぁ-ゖ]/g, char => String.fromCharCode(char.charCodeAt(0) + 0x60))
    .replace(/[\s\p{P}]+/gu, '')
}

export function filterVehicleModels(models: string[], query: string): string[] {
  const needle = normalize(query)
  return models.filter(model => [model, ...(modelAliases[model] || [])]
    .some(label => normalize(label).includes(needle)))
}
