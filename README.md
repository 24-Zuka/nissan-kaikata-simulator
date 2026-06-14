# 日産 購入方法比較シミュレーター

日産系ディーラーの営業担当者が商談中にお客様の目の前で使う、購入方法比較の業務支援Webアプリです。
5プラン（**現状維持 / 現金一括 / クレジット / BVC / おまとめプラン**）を同じ条件で比較し、
月々の支払額だけでなく、車両代・維持費・保険・車検・点検・夏冬タイヤ・将来支払まで含めた
「実質負担」を分かりやすく説明できます。

> リース商品としての表示・説明は行いません。表示名は一貫して「おまとめプラン」です。

## 技術構成

- React + TypeScript + Vite
- Decimal.js（金額計算）
- Vitest + React Testing Library（テスト）
- ESLint + Prettier

計算ロジックは `src/domain/` の純粋関数に集約し、UI（画面・印刷・お客様説明モード）は
同一の計算結果オブジェクトを表示するだけです（表示側での再計算・再丸めはしません）。

## セットアップ

```bash
npm install
npm run dev        # 開発サーバー
npm run build      # 本番ビルド（dist/）
npm run preview    # ビルド結果のプレビュー
npm test           # テスト
npm run typecheck  # 型チェック
npm run lint       # Lint
```

## 主な機能

- 詳細入力画面（入力フォーム中心）
- A/B/C 最大3パターンの比較（追加・複製・削除・切替。各パターンは独立した見積条件を持つ）
- 正式見積（手入力）モード（クレジット/BVC/おまとめ。NFS支払予定表の初回・2回目以降月額・回数を転記して優先表示）
- ボーナス加算月の複数選択、契約年数プリセット（BVC 3/4/5年・おまとめ 3/5/7年）、BVC概算残価率
- お客様説明モード（5プラン比較表・BVC返却/買取・おまとめ概要・維持費用内訳・現状維持との差額）
- 印刷（A4横1枚 / 上段=比較表・下段=維持費用内訳。QRなし・作成日1箇所）
- ローカル保存（localStorage）/ JSON書き出し・読み込み / 共有リンク（既定で個人情報を除外）

## 外部公開

SPAとしてどの端末でもURLでアクセスできます。以下のいずれかで公開できます。

### Vercel
- リポジトリを連携 → ビルド設定は `vercel.json` を自動利用（rewrite設定済み）。

### Netlify
- リポジトリを連携 → `netlify.toml`（および `public/_redirects`）でSPA rewrite済み。

### GitHub Pages
- リポジトリ Settings > Pages > Source を「GitHub Actions」に設定。
- `main` へ push すると `.github/workflows/deploy.yml` が `VITE_BASE=/<repo>/` でビルドし公開。
- 公開URL: `https://<user>.github.io/<repo>/`

### 手動（任意の静的ホスティング）
```bash
npm run build       # ルート公開
# サブパス公開時:
# VITE_BASE=/<repo>/ npm run build   （PowerShell: $env:VITE_BASE="/<repo>/"; npm run build）
```
`dist/` を配信してください。直接URLアクセス対応のため、配信側で全パスを `index.html` に
フォールバックさせてください（上記設定ファイルで対応済み）。

## NFS（日産フィナンシャルサービス）突合について

クレジット/BVCの月額・支払総額は、NFSの支払予定表との1円単位一致を最終目標としています。
実データ取得後、`src/domain/money.ts` の `ROUNDING_CONFIG` を校正し、
`src/test/fixtures/nfs-golden.ts` に支払予定表の実値を転記してください。
実値が未転記の間、ゴールデンテストは skip されます。

## ディレクトリ

```
src/
  app/            App.tsx / App.css
  components/     layout / forms / comparison / plans / print / presentation / common
  domain/         money / types / constants / estimate / installment / maintenance /
                  statusQuo / cash / credit / bvc / omatome / visibility / scenario
  hooks/          useScenarioState / useStatusQuoVisibility
  utils/          format / storage / share
  test/           fixtures(nfs-golden) / helpers
```
