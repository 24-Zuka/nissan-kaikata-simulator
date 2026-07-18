# Car Plan Advisor

自動車商談で、現状維持・現金一括・クレジット・BVC・おまとめプランの支払額と維持費を比較するReact/Vite PWAです。

## 主な機能

- 新車・中古車・現在車で分離した維持費計算
- 初度登録年月を基準にした現在車の車検回数計算
- BVC／おまとめの返却・買取と期間超過維持費
- 比較対象プランの選択、入力進捗、未入力箇所へのジャンプ
- 商談・車両、比較対象、維持費、支払条件の4段階入力
- PCの追従比較、iPad／スマホの固定操作バー
- 未完成プランの部分金額を隠す誤認防止表示
- お客様説明、実質総額チャート、A4横2ページ印刷
- 端末内保存、オフライン同期キュー、競合解決
- Clerk Organizationによる店舗・担当者単位のアクセス制御
- Upstash Redisのクラウド見積、検索、50件ページング
- 個人名を除外した共有URL
- ライト／ダークテーマ、PWA更新通知、オフラインアプリシェル

## ローカル起動

```bash
npm install
npm run dev
```

Clerk変数がない場合は移行期間用の固定パスワード認証を使います。Clerkを確認する場合は`.env.example`を基に`.env.local`を作成してください。実値はコミットしません。

## 品質確認

```bash
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
npm run check:forbidden
npm run check:secrets
```

Vitestは専用の`vitest.config.ts`でPWA生成を外し、単一ワーカーで安定実行します。PlaywrightはPC・390px・説明準備状態・5プラン印刷を検証します。Lintは生成物・監査資料・Vercel成果物を対象外にしています。

## 計算上の要点

- 維持期間はプラン別に1〜20年で設定します。
- 新車の車検は初度登録36か月目、以後24か月ごとです。維持終了月と同じ月の車検は計上しません。
- 現在車は初度登録年月と現在年月から車齢を求め、現在月の車検は計上し、維持終了月の車検は除外します。
- 法定12か月点検・6か月点検は車検と同じ月に重複計上しません。
- 現在車、新車、中古車の維持費条件は別々に保持します。
- 中古車選択時、現金・クレジットは中古車価格と中古車維持費を使います。BVC・おまとめは新車価格と新車維持費を使います。
- おまとめは車検・点検・タイヤ・税を支払期間内のリース料込みとし、任意保険は選択式、修理費は別途負担です。
- 現状維持の実質月額は、これからの月払いまたは残債月割りと、これからの維持費月額で算出します。実質総額は累計比較値を維持します。

## 保存スキーマv11

- `comparison.enabledPlans`で購入4プランの表示可否を保存します。
- v2〜v10、旧共有URL、旧クラウド見積は読込時にv11へ正規化します。
- 旧`cash.enabled`は移行時だけ参照し、新規保存には残しません。
- ローカル見積・同期キュー・移行済み状態は`organizationId`と`userId`単位で分離します。
- 共有URLは`#share=`形式で、顧客名と担当者名を除外します。

## 認証と権限

本番切替後はClerkを正とします。

- 公開登録はClerk Dashboardで無効化し、管理者のメール招待だけを許可します。
- Clerk Organizationを店舗として扱います。
- `org:member`は本人所有の見積だけを操作できます。
- `org:admin`は組織内全見積、未割当旧見積、担当者割当を操作できます。
- APIはOrganizationとユーザーを認証トークンから決定し、クライアントの所有者指定を信用しません。
- 旧固定パスワードAPIはClerk本番確認まで残し、確認後に別工程で削除します。

## クラウド同期

- 一覧APIは50件単位の概要だけを返し、見積本文は選択時に取得します。
- 保存時はローカル保存とキュー登録を同時に行います。
- `revision`不一致は409とし、サーバー版採用か端末版上書きを利用者が選択します。
- 削除日時より古いキューは見積を復活させません。
- 旧クラウド見積はIDと更新日時を維持して未割当で移行し、管理者が担当者へ割り当てます。

## 印刷

お客様説明モードから印刷します。未完成の選択プランがある場合は印刷を開始しません。

- 用紙: A4横
- 1ページ目: 顧客・車両概要、完成済みプラン比較
- 2ページ目: 維持費金額表、回数・周期表
- チャートと操作UIは印刷しません。
- `※本シミュレーションは概算です。`の注意書きを表示します。

## Vercel環境変数

```text
VITE_CLERK_PUBLISHABLE_KEY
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
CLERK_AUTHORIZED_PARTIES
UPSTASH_REDIS_REST_URL または KV_REST_API_URL
UPSTASH_REDIS_REST_TOKEN または KV_REST_API_TOKEN
```

移行期間だけ次も使用します。

```text
APP_PASSWORD
AUTH_SECRET
CLERK_DEFAULT_ORGANIZATION_ID
```

Clerk Marketplace導入、Preview公開、本番切替、旧認証変数削除は運用確認を分けて実施します。

Clerk Marketplaceは`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`を自動設定します。Vite向けの`VITE_CLERK_PUBLISHABLE_KEY`には同じ公開キーを設定します。サーバーは`CLERK_PUBLISHABLE_KEY`またはMarketplace名を参照します。
