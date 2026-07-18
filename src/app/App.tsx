import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import {
  checkSession,
  clearAuthMarker,
  hasAuthMarker,
  login,
  logout,
  setAuthMarker,
} from '../auth/authClient'
import { calculateComparison } from '../domain/comparison'
import { createInitialScenario } from '../domain/defaults'
import type { CloudScenarioSummary, SavedScenario, Scenario } from '../domain/types'
import { LoginScreen } from '../features/auth/LoginScreen'
import { PwaUpdatePrompt } from '../components/PwaUpdatePrompt'
import { ThemeToggle } from '../components/ThemeToggle'
import { BrandMark } from '../components/BrandMark'
import {
  deleteScenario,
  encodeSharedScenario,
  getScenarioFromHash,
  loadScenarios,
  replaceScenarios,
  saveScenario,
} from '../storage'
import {
  enqueueScenarioDelete,
  enqueueScenarioUpsert,
  assignCloudScenarioOwner,
  discardScenarioSync,
  fetchCloudScenario,
  fetchCloudScenarioSummaries,
  fetchOrganizationMembers,
  flushSyncQueue,
  getPendingSyncCount,
  hasCompletedCloudMigration,
  markCloudMigrationComplete,
  migrateLegacyCloudScenarios,
  SyncConflictError,
  type OrganizationMember,
} from '../storage/cloudSync'
import { getInitialTheme, saveTheme, type ThemePreference } from '../theme/theme'
import './App.css'
import './print.css'

type Mode = 'input' | 'presentation'
type AuthState = 'checking' | 'authenticated' | 'unauthenticated'
type SyncState = 'idle' | 'syncing' | 'offline' | 'error'

export type ExternalAuth = {
  userId: string
  organizationId: string
  organizationName: string
  displayName: string
  role: 'admin' | 'member'
  signOut: () => Promise<void>
}

type AppProps = {
  externalAuth?: ExternalAuth
}

const CustomerPresentation = lazy(() =>
  import('../features/customer-presentation/CustomerPresentation').then((module) => ({
    default: module.CustomerPresentation,
  })),
)
const DetailInputScreen = lazy(() =>
  import('../features/detail-input/DetailInputScreen').then((module) => ({
    default: module.DetailInputScreen,
  })),
)

function initialScenario(): Scenario {
  return getScenarioFromHash(window.location.hash) ?? createInitialScenario()
}

function initialMode(): Mode {
  return new URLSearchParams(window.location.search).get('mode') === 'presentation'
    ? 'presentation'
    : 'input'
}

export default function App({ externalAuth }: AppProps = {}) {
  const externalOrganizationId = externalAuth?.organizationId
  const externalUserId = externalAuth?.userId
  const storageScope = useMemo(
    () => externalOrganizationId && externalUserId
      ? { organizationId: externalOrganizationId, userId: externalUserId }
      : undefined,
    [externalOrganizationId, externalUserId],
  )
  const [authState, setAuthState] = useState<AuthState>(
    externalAuth ? 'authenticated' : 'checking',
  )
  const [loginBusy, setLoginBusy] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [scenario, setScenario] = useState<Scenario>(initialScenario)
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(initialScenario()))
  const [mode, setMode] = useState<Mode>(initialMode)
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>(() =>
    loadScenarios(localStorage, storageScope),
  )
  const [cloudSummaries, setCloudSummaries] = useState<CloudScenarioSummary[]>([])
  const [organizationMembers, setOrganizationMembers] = useState<OrganizationMember[]>([])
  const [selectedSavedId, setSelectedSavedId] = useState('')
  const [selectedOwnerUserId, setSelectedOwnerUserId] = useState('')
  const [message, setMessage] = useState(
    window.location.hash.startsWith('#share=')
      ? '共有データを読み込みました。顧客名と担当者名は共有されません。'
      : '',
  )
  const [shareUrl, setShareUrl] = useState('')
  const [syncState, setSyncState] = useState<SyncState>('idle')
  const [pendingSyncCount, setPendingSyncCount] = useState(() =>
    getPendingSyncCount(localStorage, storageScope),
  )
  const [migrationCount, setMigrationCount] = useState(0)
  const [migrationDismissed, setMigrationDismissed] = useState(false)
  const [syncConflictId, setSyncConflictId] = useState('')
  const [theme, setTheme] = useState<ThemePreference>(getInitialTheme)
  const result = useMemo(() => calculateComparison(scenario), [scenario])
  const scenarioSnapshot = useMemo(() => JSON.stringify(scenario), [scenario])
  const hasUnsavedChanges = scenarioSnapshot !== savedSnapshot
  const scenarioOptions = useMemo(() => {
    const merged = new Map<string, {
      id: string
      name: string
      updatedAt: string
      ownerName?: string
    }>()
    for (const item of [...cloudSummaries, ...savedScenarios]) {
      const current = merged.get(item.id)
      if (!current || item.updatedAt > current.updatedAt) {
        merged.set(item.id, {
          id: item.id,
          name: item.name,
          updatedAt: item.updatedAt,
          ownerName: item.ownerName,
        })
      }
    }
    return [...merged.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [cloudSummaries, savedScenarios])

  useEffect(() => {
    if (!hasUnsavedChanges) return
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warnBeforeUnload)
    return () => window.removeEventListener('beforeunload', warnBeforeUnload)
  }, [hasUnsavedChanges])

  useEffect(() => {
    if (selectedSavedId && !scenarioOptions.some((saved) => saved.id === selectedSavedId)) {
      setSelectedSavedId('')
    }
  }, [scenarioOptions, selectedSavedId])

  useEffect(() => {
    if (externalAuth) return
    let active = true
    const restoreSession = async () => {
      if (!navigator.onLine && hasAuthMarker()) {
        if (active) setAuthState('authenticated')
        return
      }
      try {
        const authenticated = await checkSession()
        if (!active) return
        if (authenticated) {
          setAuthMarker()
          setAuthState('authenticated')
        } else {
          clearAuthMarker()
          setAuthState('unauthenticated')
        }
      } catch {
        if (!active) return
        if (hasAuthMarker()) {
          setAuthState('authenticated')
          setSyncState('offline')
        } else {
          setAuthState('unauthenticated')
          setLoginError('通信を確認して、もう一度お試しください。')
        }
      }
    }
    void restoreSession()
    return () => {
      active = false
    }
  }, [externalAuth])

  const synchronize = useCallback(async () => {
    if (authState !== 'authenticated') return
    if (!navigator.onLine) {
      setSyncState('offline')
      setPendingSyncCount(getPendingSyncCount(localStorage, storageScope))
      return
    }

    setSyncState('syncing')
    try {
      if (!hasCompletedCloudMigration(localStorage, storageScope)) {
        const localScenarios = loadScenarios(localStorage, storageScope)
        const cloudScenarios = await fetchCloudScenarioSummaries()
        setCloudSummaries(cloudScenarios)
        if (localScenarios.length > 0) {
          setSavedScenarios(localScenarios)
          if (!migrationDismissed) setMigrationCount(localScenarios.length)
          setSyncState('idle')
          return
        }
        markCloudMigrationComplete(localStorage, storageScope)
      }

      await flushSyncQueue(localStorage, storageScope)
      const cloudScenarios = await fetchCloudScenarioSummaries()
      setCloudSummaries(cloudScenarios)
      setSavedScenarios(loadScenarios(localStorage, storageScope))
      setPendingSyncCount(0)
      setMigrationCount(0)
      setSyncState('idle')
    } catch (error) {
      setPendingSyncCount(getPendingSyncCount(localStorage, storageScope))
      setSyncState('error')
      if (error instanceof SyncConflictError) setSyncConflictId(error.scenarioId)
      setMessage(error instanceof Error ? error.message : 'クラウド同期に失敗しました。')
    }
  }, [authState, migrationDismissed, storageScope])

  useEffect(() => {
    if (authState !== 'authenticated') return
    void synchronize()
    const handleOnline = () => void synchronize()
    const handleOffline = () => setSyncState('offline')
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [authState, synchronize])

  useEffect(() => {
    if (authState !== 'authenticated' || externalAuth?.role !== 'admin') return
    let active = true
    void fetchOrganizationMembers()
      .then((members) => {
        if (active) setOrganizationMembers(members)
      })
      .catch(() => {
        if (active) setMessage('担当者一覧を取得できませんでした。')
      })
    return () => { active = false }
  }, [authState, externalAuth?.role])

  const handleLogin = async (password: string) => {
    setLoginBusy(true)
    setLoginError('')
    try {
      await login(password)
      setAuthState('authenticated')
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'ログインできませんでした。')
    } finally {
      setLoginBusy(false)
    }
  }

  const handleLogout = async () => {
    if (externalAuth) await externalAuth.signOut()
    else await logout()
    setAuthState('unauthenticated')
    setLoginError('')
  }

  const handleMigration = async () => {
    const localScenarios = loadScenarios(localStorage, storageScope)
    for (const saved of localScenarios) {
      enqueueScenarioUpsert(saved, localStorage, storageScope)
    }
    markCloudMigrationComplete(localStorage, storageScope)
    setMigrationCount(0)
    setPendingSyncCount(getPendingSyncCount(localStorage, storageScope))
    setMessage(`${localScenarios.length}件の見積をクラウド同期へ追加しました。`)
    await synchronize()
  }

  const handleSave = async () => {
    try {
      const saved = saveScenario(
        scenario,
        selectedSavedId || undefined,
        localStorage,
        storageScope,
      )
      enqueueScenarioUpsert(saved, localStorage, storageScope)
      setSelectedSavedId(saved.id)
      setSavedScenarios(loadScenarios(localStorage, storageScope))
      setPendingSyncCount(getPendingSyncCount(localStorage, storageScope))
      setMessage(`「${saved.name}」を端末に保存しました。`)
      setSavedSnapshot(JSON.stringify(saved.scenario))
      if (hasCompletedCloudMigration(localStorage, storageScope)) await synchronize()
      else if (!migrationDismissed) {
        setMigrationCount(loadScenarios(localStorage, storageScope).length)
      }
    } catch {
      setMessage('保存できませんでした。ブラウザの保存領域を確認してください。')
    }
  }

  const handleLoad = async (id: string) => {
    if (
      hasUnsavedChanges
      && !window.confirm('未保存の変更があります。破棄して別の見積へ切り替えますか？')
    ) return
    setSelectedSavedId(id)
    if (!id) {
      const nextScenario = createInitialScenario()
      setScenario(nextScenario)
      setSavedSnapshot(JSON.stringify(nextScenario))
      setMessage('新しい見積を開始しました。')
      return
    }
    let saved = savedScenarios.find((item) => item.id === id)
    const cloud = cloudSummaries.find((item) => item.id === id)
    if (cloud && (!saved || cloud.serverUpdatedAt > saved.updatedAt)) {
      try {
        saved = await fetchCloudScenario(id)
        setSavedScenarios(replaceScenarios(
          [
            saved,
            ...loadScenarios(localStorage, storageScope).filter((item) => item.id !== id),
          ],
          localStorage,
          storageScope,
        ))
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '見積を読み込めませんでした。')
        return
      }
    }
    if (saved) {
      setScenario(saved.scenario)
      setSavedSnapshot(JSON.stringify(saved.scenario))
      setMessage(`「${saved.name}」を読み込みました。`)
    }
  }

  const handleDelete = async () => {
    if (!selectedSavedId) return
    if (!window.confirm('この見積をクラウドを含む全端末から削除しますか？')) return
    try {
      setSavedScenarios(deleteScenario(selectedSavedId, localStorage, storageScope))
      setCloudSummaries((current) => current.filter((item) => item.id !== selectedSavedId))
      enqueueScenarioDelete(selectedSavedId, localStorage, storageScope)
      setSelectedSavedId('')
      setPendingSyncCount(getPendingSyncCount(localStorage, storageScope))
      setMessage('保存済み見積を削除しました。')
      if (hasCompletedCloudMigration(localStorage, storageScope)) await synchronize()
    } catch {
      setMessage('削除できませんでした。ブラウザの保存領域を確認してください。')
    }
  }

  const handleAssignOwner = async () => {
    if (!selectedSavedId || !selectedOwnerUserId) return
    const member = organizationMembers.find((item) => item.userId === selectedOwnerUserId)
    if (!member) return
    try {
      const updated = await assignCloudScenarioOwner(selectedSavedId, member)
      const { scenario: _scenario, ...updatedSummary } = updated
      void _scenario
      setCloudSummaries((current) => current.map((item) =>
        item.id === updated.id ? updatedSummary : item,
      ))
      setSelectedOwnerUserId('')
      setMessage(`「${updated.name}」を${updated.ownerName}さんへ割り当てました。`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '担当者を割り当てられませんでした。')
    }
  }

  const handleLegacyCloudMigration = async () => {
    if (!window.confirm('旧クラウド見積を未割当のまま現在の店舗組織へ移行しますか？')) return
    try {
      const migrated = await migrateLegacyCloudScenarios()
      setMessage(`${migrated}件の旧クラウド見積を移行しました。`)
      await synchronize()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '旧見積を移行できませんでした。')
    }
  }

  const adoptServerConflict = async () => {
    if (!syncConflictId) return
    try {
      const serverScenario = await fetchCloudScenario(syncConflictId)
      discardScenarioSync(syncConflictId, localStorage, storageScope)
      const cached = replaceScenarios(
        [
          serverScenario,
          ...loadScenarios(localStorage, storageScope).filter(
            (item) => item.id !== syncConflictId,
          ),
        ],
        localStorage,
        storageScope,
      )
      setSavedScenarios(cached)
      if (selectedSavedId === syncConflictId) {
        setScenario(serverScenario.scenario)
        setSavedSnapshot(JSON.stringify(serverScenario.scenario))
      }
      setMessage('サーバー側の見積を採用しました。')
    } catch (error) {
      if (!(error instanceof Error) || error.message !== '見積が見つかりません。') {
        setMessage(error instanceof Error ? error.message : 'サーバー版を取得できませんでした。')
        return
      }
      discardScenarioSync(syncConflictId, localStorage, storageScope)
      setSavedScenarios(deleteScenario(syncConflictId, localStorage, storageScope))
      if (selectedSavedId === syncConflictId) setSelectedSavedId('')
      setMessage('サーバー側で削除済みのため、端末の保留データを破棄しました。')
    }
    setSyncConflictId('')
    setPendingSyncCount(getPendingSyncCount(localStorage, storageScope))
    await synchronize()
  }

  const overwriteServerConflict = async () => {
    if (!syncConflictId) return
    try {
      await flushSyncQueue(localStorage, storageScope, syncConflictId)
      setSyncConflictId('')
      setMessage('端末側の見積でクラウドを上書きしました。')
      await synchronize()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '競合を解決できませんでした。')
    }
  }

  const handleShare = async () => {
    const encoded = encodeSharedScenario(scenario)
    const url = `${window.location.origin}${window.location.pathname}#share=${encoded}`
    setShareUrl(url)
    try {
      await navigator.clipboard.writeText(url)
      setMessage('個人名を除いた共有URLをコピーしました。')
    } catch {
      setMessage('共有URLを作成しました。下の欄からコピーしてください。')
    }
  }

  const handlePrint = () => {
    if (result.incompletePlans.length > 0 || result.completePlans.length === 0) {
      setMode('input')
      setMessage(
        `印刷できません。選択中の未完成プランを入力するか、比較対象から外してください（${result.incompletePlans.length}件）。`,
      )
      return
    }
    setMode('presentation')
    window.setTimeout(() => window.print(), 100)
  }

  const handleThemeChange = (nextTheme: ThemePreference) => {
    setTheme(nextTheme)
    saveTheme(nextTheme)
  }

  const confirmLogout = async () => {
    if (
      hasUnsavedChanges
      && !window.confirm('未保存の変更があります。破棄してログアウトしますか？')
    ) return
    await handleLogout()
  }

  if (authState === 'checking') {
    return <div className="auth-loading" role="status">ログイン状態を確認しています…</div>
  }
  if (authState === 'unauthenticated') {
    return <LoginScreen busy={loginBusy} error={loginError} onLogin={handleLogin} />
  }

  const syncLabel =
    syncState === 'syncing'
      ? '同期中…'
      : syncState === 'offline'
        ? `オフライン${pendingSyncCount ? `・未同期${pendingSyncCount}件` : ''}`
        : syncState === 'error'
          ? `同期エラー${pendingSyncCount ? `・未同期${pendingSyncCount}件` : ''}`
          : pendingSyncCount
            ? `未同期${pendingSyncCount}件`
            : 'クラウド同期済み'

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <BrandMark />
          <div>
            <strong>Car Plan Advisor</strong>
            <span>Sales Support Tool</span>
          </div>
        </div>

        <nav className="mode-nav" aria-label="表示モード">
          <button className={mode === 'input' ? 'is-active' : ''} onClick={() => setMode('input')} type="button">詳細入力</button>
          <button className={mode === 'presentation' ? 'is-active' : ''} onClick={() => setMode('presentation')} type="button">お客様説明</button>
        </nav>

        <ThemeToggle value={theme} onChange={handleThemeChange} />

        <div className="header-actions">
          {externalAuth && (
            <span className="user-chip" title={externalAuth.organizationName}>
              {externalAuth.displayName}・{externalAuth.role === 'admin' ? '管理者' : '担当者'}
            </span>
          )}
          <span className={`sync-status sync-status--${syncState}`}>{syncLabel}</span>
          <button className="button button--quiet" onClick={handleShare} type="button">共有データ</button>
          <button className="button button--quiet" onClick={handlePrint} type="button">印刷</button>
          <button className="button button--quiet" onClick={() => void confirmLogout()} type="button">ログアウト</button>
          <button className="button button--primary" onClick={handleSave} type="button">保存</button>
        </div>
        <div className="mobile-header-actions">
          <span className={`sync-status sync-status--${syncState}`}>{syncLabel}</span>
          <button className="button button--primary" onClick={handleSave} type="button">保存</button>
          <details>
            <summary className="button button--quiet">その他</summary>
            <div>
              <button onClick={handleShare} type="button">共有データ</button>
              <button onClick={handlePrint} type="button">印刷</button>
              <button disabled={syncState === 'syncing'} onClick={() => void synchronize()} type="button">再同期</button>
              <button onClick={() => void confirmLogout()} type="button">ログアウト</button>
            </div>
          </details>
        </div>
      </header>

      <section className="scenario-bar" aria-label="保存済み見積">
        <label>
          <span>全端末共通の保存済み見積</span>
          <select value={selectedSavedId} onChange={(event) => void handleLoad(event.target.value)}>
            <option value="">新規見積</option>
            {scenarioOptions.map((saved) => (
              <option key={saved.id} value={saved.id}>
                {saved.name}{saved.ownerName ? `・${saved.ownerName}` : ''}（{new Date(saved.updatedAt).toLocaleDateString('ja-JP')}）
              </option>
            ))}
          </select>
        </label>
        <div className="scenario-bar__actions">
          <button className="text-button" disabled={syncState === 'syncing'} onClick={() => void synchronize()} type="button">再同期</button>
          <button className="text-button text-button--danger" disabled={!selectedSavedId} onClick={() => void handleDelete()} type="button">選択中の保存を削除</button>
        </div>
      </section>

      {externalAuth?.role === 'admin' && (
        <section className="admin-scenario-tools" aria-label="管理者用クラウド見積管理">
          <div>
            <strong>担当者割当</strong>
            <span>選択中のクラウド見積を店舗内の担当者へ割り当てます。</span>
          </div>
          <select
            aria-label="割当先担当者"
            value={selectedOwnerUserId}
            onChange={(event) => setSelectedOwnerUserId(event.target.value)}
          >
            <option value="">担当者を選択</option>
            {organizationMembers.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.name}（{member.role === 'admin' ? '管理者' : '担当者'}）
              </option>
            ))}
          </select>
          <button
            className="button button--quiet"
            disabled={!selectedSavedId || !selectedOwnerUserId}
            onClick={() => void handleAssignOwner()}
            type="button"
          >
            割り当て
          </button>
          <button
            className="text-button"
            onClick={() => void handleLegacyCloudMigration()}
            type="button"
          >
            旧クラウド見積を確認・移行
          </button>
        </section>
      )}

      {migrationCount > 0 && (
        <section className="migration-panel" aria-label="端末内見積のクラウド移行">
          <div>
            <strong>端末内の見積をクラウドへ移行</strong>
            <span>{migrationCount}件の保存済み見積があります。</span>
          </div>
          <button className="button button--primary" onClick={() => void handleMigration()} type="button">{migrationCount}件を移行</button>
          <button className="button button--quiet" onClick={() => { setMigrationCount(0); setMigrationDismissed(true) }} type="button">あとで</button>
        </section>
      )}

      {syncConflictId && (
        <section className="conflict-panel" role="alert" aria-label="同期競合の解決">
          <div>
            <strong>別の端末で見積が変更されています</strong>
            <span>使用する内容を選択してください。端末版で上書きするとサーバー側の変更は戻せません。</span>
          </div>
          <button className="button button--quiet" onClick={() => void adoptServerConflict()} type="button">
            サーバー版を採用
          </button>
          <button className="button button--primary" onClick={() => void overwriteServerConflict()} type="button">
            端末版で上書き
          </button>
        </section>
      )}

      <PwaUpdatePrompt />

      {message && (
        <div className="notice" role="status">
          <span>{message}</span>
          <button type="button" onClick={() => setMessage('')} aria-label="通知を閉じる">閉じる</button>
        </div>
      )}

      {shareUrl && (
        <div className="share-panel">
          <label>
            <span>共有URL（顧客名・担当者名を除外済み）</span>
            <input readOnly value={shareUrl} onFocus={(event) => event.target.select()} />
          </label>
          <button type="button" onClick={() => setShareUrl('')}>閉じる</button>
        </div>
      )}

      <Suspense fallback={<div className="screen-loading" role="status">画面を読み込んでいます…</div>}>
        {mode === 'input' ? (
          <DetailInputScreen scenario={scenario} result={result} onChange={setScenario} />
        ) : (
          <CustomerPresentation scenario={scenario} result={result} />
        )}
      </Suspense>
    </div>
  )
}
