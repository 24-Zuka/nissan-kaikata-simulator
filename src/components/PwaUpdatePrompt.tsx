import { useRegisterSW } from 'virtual:pwa-register/react'

export function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <div className="pwa-update" role="status">
      <span>新しいバージョンを利用できます。</span>
      <button
        className="button button--primary"
        onClick={() => void updateServiceWorker(true)}
        type="button"
      >
        更新する
      </button>
      <button
        className="button button--quiet"
        onClick={() => setNeedRefresh(false)}
        type="button"
      >
        あとで
      </button>
    </div>
  )
}
