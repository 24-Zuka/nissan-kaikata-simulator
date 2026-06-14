/**
 * アプリのルート。
 * 詳細入力画面 / お客様説明モード / 印刷プレビュー を切り替える。
 * 計算は useScenarioState（calculateScenario）に集約し、各ビューは結果を表示するだけ。
 */

import { useRef, useState } from 'react'
import { useScenarioState } from '../hooks/useScenarioState'
import { useStatusQuoVisibility } from '../hooks/useStatusQuoVisibility'
import { InputScreen } from '../components/forms/InputScreen'
import { PresentationView } from '../components/presentation/PresentationView'
import { PrintView } from '../components/print/PrintView'
import { buildShareUrl, exportScenarioJson, importScenarioJson } from '../utils/share'

type View = 'input' | 'presentation' | 'print'

export function App() {
  const state = useScenarioState()
  const { scenario, result } = state
  const visibility = useStatusQuoVisibility(scenario.currentCar)
  const patternLabels = ['A', 'B', 'C']
  const [view, setView] = useState<View>('input')
  const [notice, setNotice] = useState<string>('')
  const fileRef = useRef<HTMLInputElement>(null)

  const flash = (msg: string) => {
    setNotice(msg)
    window.setTimeout(() => setNotice(''), 2500)
  }

  const handleShare = async () => {
    const base = `${window.location.origin}${window.location.pathname}`
    const url = buildShareUrl(scenario, base, false) // 個人情報は既定で除外
    try {
      await navigator.clipboard.writeText(url)
      flash('共有リンクをコピーしました（個人情報は除外）')
    } catch {
      flash('コピーに失敗しました。URLを手動で取得してください。')
    }
  }

  const handleExport = () => {
    const json = exportScenarioJson(scenario)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${scenario.name || 'mitsumori'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImportFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      const next = importScenarioJson(String(reader.result ?? ''))
      if (next) {
        state.replace(next)
        flash('読み込みました')
      } else {
        flash('読み込みに失敗しました（不正なデータ）')
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__brand">
          <span className="app__logo" aria-hidden="true">
            NISSAN
          </span>
          <span className="app__appname">購入方法比較シミュレーター</span>
        </div>
        <nav className="app__nav" aria-label="表示切替">
          <button
            type="button"
            className={view === 'input' ? 'app__navbtn is-active' : 'app__navbtn'}
            onClick={() => setView('input')}
          >
            詳細入力
          </button>
          <button
            type="button"
            className={view === 'presentation' ? 'app__navbtn is-active' : 'app__navbtn'}
            onClick={() => setView('presentation')}
          >
            お客様説明モード
          </button>
          <button
            type="button"
            className={view === 'print' ? 'app__navbtn is-active' : 'app__navbtn'}
            onClick={() => setView('print')}
          >
            印刷
          </button>
        </nav>
        <div className="app__actions">
          {view === 'print' ? (
            <button type="button" className="app__btn app__btn--primary" onClick={() => window.print()}>
              印刷する
            </button>
          ) : null}
          <button type="button" className="app__btn" onClick={handleShare}>
            共有リンク
          </button>
          <button type="button" className="app__btn" onClick={handleExport}>
            書き出し
          </button>
          <button type="button" className="app__btn" onClick={() => fileRef.current?.click()}>
            読み込み
          </button>
          <button
            type="button"
            className="app__btn"
            onClick={() => {
              if (window.confirm('入力内容をリセットします。よろしいですか？')) {
                state.reset()
                flash('リセットしました')
              }
            }}
          >
            リセット
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="app__file"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleImportFile(f)
              e.target.value = ''
            }}
          />
        </div>
      </header>

      {/* A/B/C パターン切替（最大3パターン） */}
      <div className="patternbar" role="tablist" aria-label="比較パターン">
        <div className="patternbar__tabs">
          {state.patterns.map((p, i) => {
            const label = patternLabels[i] ?? String(i + 1)
            return (
              <div
                key={p.id}
                className={p.id === state.activeId ? 'patterntab is-active' : 'patterntab'}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={p.id === state.activeId}
                  className="patterntab__main"
                  onClick={() => state.switchPattern(p.id)}
                >
                  <span className="patterntab__badge">{label}</span>
                  <span className="patterntab__name">{p.name || '無題'}</span>
                </button>
                {state.canDeletePattern ? (
                  <button
                    type="button"
                    className="patterntab__del"
                    aria-label={`パターン${label}を削除`}
                    onClick={() => {
                      if (window.confirm(`パターン${label}を削除しますか？`)) {
                        state.deletePattern(p.id)
                      }
                    }}
                  >
                    ×
                  </button>
                ) : null}
              </div>
            )
          })}
        </div>
        <div className="patternbar__actions">
          <button
            type="button"
            className="app__btn"
            disabled={!state.canAddPattern}
            onClick={() => state.addPattern()}
          >
            ＋ 追加
          </button>
          <button
            type="button"
            className="app__btn"
            disabled={!state.canAddPattern}
            onClick={() => state.duplicatePattern()}
          >
            複製
          </button>
        </div>
      </div>

      {notice ? <div className="app__notice" role="status">{notice}</div> : null}

      <main className="app__main">
        {view === 'input' ? <InputScreen state={state} /> : null}
        {view === 'presentation' ? (
          <PresentationView scenario={scenario} result={result} visibility={visibility} />
        ) : null}
        {view === 'print' ? (
          <PrintView scenario={scenario} result={result} visibility={visibility} />
        ) : null}
      </main>
    </div>
  )
}
