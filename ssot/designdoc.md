```
Markdownテキストを、Canvas上で自動レンダリングさせず、「プレーンテキスト（Text）」または「Markdownファイル」のソースコード枠として出力してください。
Canvasが勝手にリッチテキストに変換するのを防ぐため、コードブロック全体の囲みにはバッククォート4つ（````）を使用し、言語指定を「text」にしてください。
```

要件定義書 兼 基本設計書（SSOT v1.8）

1. プロジェクト概要 (Project Overview)
・プロジェクト名: Cafe-Search (仮称)
・目的: PC作業や勉強を重視するリモートワーカー・学習者向けに、「作業環境（電源・Wi-Fi）」と「空間の魅力（おしゃれさ）」を両立したカフェを直感的に探せるスワイプ型マッチングWebアプリケーションを提供する。
・ターゲット地域: まずは「渋谷エリア」に特化してデータベースを構築・提供し、順次対応エリア（新宿等）を拡大する。
・アーキテクチャ方針: AI駆動開発（AI-Driven Development）を採用。Google Places API と Gemini API（LLM）等を組み合わせた低コスト・高効率な自動データ収集・AI解析パイプラインを構築し、Firestoreへ事前にデータを蓄積する。本ドキュメントをシステム全体のSSOT（Single Source of Truth）として運用する。
・対象ドメイン: cafe-search.immersed-in-knowing.com

2. システムアーキテクチャ・技術スタック (System Architecture & Tech Stack)
2.1 基本技術スタック & 実行環境
・Node.js: v24.19.0
・ビルドツール: Vite (v8.x)
・フロントエンド: React (TypeScript / React-TS)
・CSSフレームワーク: Tailwind CSS (v3.x) + PostCSS + Autoprefixer
・アイコンライブラリ: lucide-react
・バージョン管理: Git / GitHub（トークン認証・リモートリポジトリ設定済み）

2.2 インフラ構成 (Google Cloud Platform)
・フロントエンドホスティング: Cloud Run (Scale to Zero による低コスト運用)
・データベース: Firestore (Standard Edition / ネイティブモード / asia-northeast1 東京 / データベースID: cafe-search)
・データ収集・AIバッチ処理: Cloud Run Jobs + Cloud Scheduler + Gemini API (LLM)

2.3 地図描画・API連携
・地図描画: Google Maps JavaScript API (Dynamic Maps)
・店舗情報収集: Google Places API (New) / Text Search
・地図コスト戦略（マップ保持設計）:
アプリのルーティング遷移（タブ/画面切り替え）において地図コンポーネントを再読み込み（再マウント）させないSPAアーキテクチャを採用する。地図インスタンスを一度生成した後は裏側に保持（表示/非表示のCSS制御など）し、無駄なAPI再読み込みと課金を防止・最小化する。

3. 画面構成と機能要件 (Screens & Functional Requirements)
3.1 画面構成 (SPA内ルーティング)
・TopScreen: エリア選択（すべて/渋谷/新宿）、Google Maps表示（Like済みピン連携）、スワイプ画面への遷移動線。
・SwipeScreen: Tinder風のカードスタックUI。物理的なドラッグ/タッチ操作による Like / Dislike 判定。
・ListScreen: Likeしたカフェの一覧表示および「食べログ」外部動的リンクへの導線。

3.2 機能要件
・F1. スワイプマッチングUI: カードスタックUI、物理的なドラッグ/タッチ操作によるLike/Dislike判定。
・F2. 行きたいカフェマップ (My Map): Likes（保存済み）のカフェを地図上にピン留め表示。
・F3. 食べログ動的リンク生成: 離脱防止のため別タブ(target="_blank")で遷移。https://tabelog.com/rst/rstsearch/?keyword={店舗名}+{エリア名} の動的URLを生成。
・F4. データ永続化: ユーザー登録を行わず、ブラウザの localStorage を使用してLike/Dislike履歴を保持。
・F5. AIカフェデータ自動生成・バッチ同期: Google Places APIとLLM解析を組み合わせ、作業環境（電源・Wi-Fi）および各種スコアを事前作成してFirestoreに蓄積。

4. データ設計 (Data Schema - Firestore)
Firestoreのデータベース構造は以下の通り定義する。
・データベースID: cafe-search
・コレクション名: cafes
・ドキュメントID: Google Places API の placeId（例: ChIJ1_ROASTERY...）
※Googleマップ上の特定の店舗識別子と1対1で同期させることで、重複登録を防止しAPI連携を最適化する。

4.1 フィールド定義 (Field Schema)
【1】placeId
・型: string
・必須: ○
・説明: ドキュメントIDと同一。Google Places APIのユニーク識別子。

【2】name
・型: string
・必須: ○
・説明: 店舗名（例: "ROASTERY TOKYO SHIBUYA"）

【3】address
・型: string
・必須: ○
・説明: フル住所（例: "東京都渋谷区神南1-2-3"）

【4】station
・型: string
・必須: ○
・説明: エリア/主要駅区分（例: "渋谷", "新宿"）。エリアフィルターに使用。

【5】location
・型: map (object)
・必須: ○
・説明: 緯度経度情報 { lat: number, lng: number }。Google Maps上のピン描画に使用。

【6】mapPosition
・型: map (object)
・必須: ○
・説明: Relative表示用位置座標 { x: number, y: number }（0〜100%）。

【7】rating
・型: number
・必須: ○
・説明: Google Places API上の評価スコア（0.0 〜 5.0）。

【8】photoUrls
・型: array [string]
・必須: ○
・説明: 店舗画像の公開URL配列。Places API Media URL (`https://places.googleapis.com/v1/{photo.name}/media?...`) へ変換して保持する。

【9】scores
・型: map (object)
・必須: ○
・説明: 独自スコア構造体（AI解析により事前生成）
  workability: number (1.0〜5.0 / 作業・勉強適性スコア)
  stylishness: number (1.0〜5.0 / おしゃれ度スコア)

【10】features
・型: map (object)
・必須: ○
・説明: 設備フラグ構造体（AI解析により事前生成）
  hasOutlet: boolean (コンセント/電源の有無)
  hasWifi: boolean (Wi-Fiの有無)

【11】isChain
・型: boolean
・必須: ○
・説明: 大手チェーン店フラグ（例: ベローチェ、ドトール等は true）。おすすめ度や表示優先順位の制御ロジックに使用する。

【12】updatedAt
・型: timestamp / string
・必須: ○
・説明: データ更新日時。バッチ処理による書き込み時に設定。

4.2 データ収集 & AI補完パイプライン (Data Ingestion Pipeline)
1. 基本データ取得 (Google Places API)
・対象エリア（例: "渋谷"）のカフェ情報を Places API (New) Text Search で検索取得。
・`placeId`, `name`, `address`, `location`, `rating`, `photos` 等を抽出。
・抽出した写真リソース名（`photos[].name`）は、Places API の Media リクエスト URL (`https://places.googleapis.com/v1/{name}/media?maxHeightPx=800&maxWidthPx=800&key={API_KEY}`) に変換し、`photoUrls` 配列を作成する。

2. AI属性・スコア解析 (Gemini API / LLM)
・取得したクチコミ（reviews）や店舗概要テキストを Gemini API へ入力。
・電源(hasOutlet)・Wi-Fi(hasWifi)の有無、作業適性(workability)、おしゃれ度(stylishness)を JSON 形式で抽出し、事前生成。

3. DB書き込み (Firestore Upsert)
・データベース `cafe-search` の `placeId` をドキュメントキーとして、整形データを Firestore に Upsert（`merge: true`）保存。重複防止と低コスト運用を実現。

5. 非機能要件 (Non-Functional Requirements)
5.1 パフォーマンス・コスト最適化
・SPA Map Persistence:
地図描画は「1セッションにつき1回の読み込み」を原則とする。トップ画面遷移時に地図を再生成しない実装を必須とする。
・スケーリング対策:
月間28,500回（無料枠）を超過するトラフィックが発生した場合、以下の優先順位でコスト最適化を図る。
  1. Maps Static APIへの移行: 静止画マップへ切り替え、APIコストを大幅低減。
  2. Mapboxへの移行: 50,000回まで無料枠がある代替サービスへの乗り換え検討。

5.2 セキュリティ・環境変数管理（`.env.local` 共通利用）
・環境変数管理方針:
APIキーや設定情報は Git で追跡管理しないため `.gitignore` に登録する `.env.local` を唯一の参照元（SSOT）とし、ローカル開発・本番デプロイ双方で同じ定義を利用する。具体の値はリポジトリに含めず、変数のキー名のみをドキュメント上で定義する。
・フロントエンドにおけるビルド時埋め込み:
Vite（React）の `import.meta.env.VITE_*` はビルド時に静的にインライン展開されるため、デプロイ用ビルド時（Cloud Build）に `.env.local` の内容をもとに生成した設定を読み込ませる。
・HTTP リファラー制限: https://cafe-search.immersed-in-knowing.com/* および開発環境のみにアクセスを限定。
・API 制限: 「Maps JavaScript API」および「Places API (New)」のみを許可し、他APIの不正利用を防止する。
・Firestore Security Rules:
デフォルト「限定的」で作成後、Webアプリからの読み取り（read）のみを許可し、クライアントからの直接書き込み（write）は禁止（書き込みは管理用/バッチのGCPコンテキストのみ許可）に設定する。

6. コンプライアンス・制約事項
・Tabelog制約: 食べログデータのスクレイピングは一切不可。https://tabelog.com/rst/rstsearch/?keyword={店舗名}+{エリア名} の動的URL生成による直リンク遷移（target="_blank"）のみで実装すること。
・AI運用: 実装時は本SSOTを必ず遵守すること。

7. 本番環境デプロイ・インフラ設計 (Cloud Run Deployment)
7.1 デプロイ概要・アーキテクチャ
Cloud Run 上で React SPA を「Scale to Zero（無アクセス時は0インスタンス）」で運用するため、Nginx を使用したマルチステージ Docker ビルドを実施する。
Cloud Run のデフォルトURL (`https://cafe-search-678473793429.asia-northeast1.run.app`) へのアクセスは、Nginx 内でカスタムドメイン (`https://cafe-search.immersed-in-knowing.com`) へ 301 リダイレクト処理を行う。

```
[ ローカルソースコード & .env.local ] 
       │
       ├─ Step 1: Dockerfile と nginx.conf の作成（301リダイレクト設定含む）
       ├─ Step 2: env.yaml の作成 (.env.local から生成・.gitignore 登録)
       ├─ Step 3: Cloud Run へデプロイ (--build-env-vars-file env.yaml)
       ├─ Step 4: Google Cloud APIキーのリファラー制限設定
       └─ Step 5: カスタムドメイン (cafe-search.immersed-in-knowing.com) 設定
```

7.2 設定ファイル仕様

① Nginx 設定ファイル (`nginx.conf`)
React Router 等の SPA ルーティングによる 404 エラー防止、および Cloud Run デフォルトURLからカスタムドメインへの 301 リダイレクト設定。

```nginx
server {
    listen 8080;
    server_name _;

    # Cloud RunデフォルトURLからカスタムドメインへの301リダイレクト
    if ($host = 'cafe-search-678473793429.asia-northeast1.run.app') {
        return 301 [https://cafe-search.immersed-in-knowing.com](https://cafe-search.immersed-in-knowing.com)$request_uri;
    }

    location / {
        root /usr/share/nginx/html;
        index index.html index.htm;
        try_files $uri $uri/ /index.html;
    }

    error_page 500 502 503 504 /50x.html;
    location = /50x.html {
        root /usr/share/nginx/html;
    }
}
```

② Dockerfile (`Dockerfile`)
`.env.local` / `env.yaml` から渡されたビルド用引数（ARG）を Vite のビルド環境変数（ENV）へ注入してビルドする。

```dockerfile
# --- Stage 1: Build Stage ---
FROM node:24-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

ARG VITE_GOOGLE_MAPS_API_KEY
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_STORAGE_BUCKET
ARG VITE_FIREBASE_MESSAGING_SENDER_ID
ARG VITE_FIREBASE_APP_ID
ARG VITE_FIREBASE_MEASUREMENT_ID
ARG VITE_FIREBASE_DATABASE_ID

ENV VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY
ENV VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY
ENV VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN
ENV VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID
ENV VITE_FIREBASE_STORAGE_BUCKET=$VITE_FIREBASE_STORAGE_BUCKET
ENV VITE_FIREBASE_MESSAGING_SENDER_ID=$VITE_FIREBASE_MESSAGING_SENDER_ID
ENV VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID
ENV VITE_FIREBASE_MEASUREMENT_ID=$VITE_FIREBASE_MEASUREMENT_ID
ENV VITE_FIREBASE_DATABASE_ID=$VITE_FIREBASE_DATABASE_ID

COPY . .
RUN npm run build

# --- Stage 2: Production Stage ---
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
```

7.3 デプロイ実行手順

1. `env.yaml` の準備（`.env.local` からビルド時引数用YAMLを作成）
※ Git管理を避けるため `.env.local` と同様に `env.yaml` を `.gitignore` に追加します。`.env.local` の値を元に以下の構造で作成します。

例 (`env.yaml` テンプレート構造):
```yaml
VITE_GOOGLE_MAPS_API_KEY: "<.env.localのVITE_GOOGLE_MAPS_API_KEYの値>"
VITE_FIREBASE_API_KEY: "<.env.localのVITE_FIREBASE_API_KEYの値>"
VITE_FIREBASE_AUTH_DOMAIN: "<.env.localのVITE_FIREBASE_AUTH_DOMAINの値>"
VITE_FIREBASE_PROJECT_ID: "<.env.localのVITE_FIREBASE_PROJECT_IDの値>"
VITE_FIREBASE_STORAGE_BUCKET: "<.env.localのVITE_FIREBASE_STORAGE_BUCKETの値>"
VITE_FIREBASE_MESSAGING_SENDER_ID: "<.env.localのVITE_FIREBASE_MESSAGING_SENDER_IDの値>"
VITE_FIREBASE_APP_ID: "<.env.localのVITE_FIREBASE_APP_IDの値>"
VITE_FIREBASE_MEASUREMENT_ID: "<.env.localのVITE_FIREBASE_MEASUREMENT_IDの値>"
VITE_FIREBASE_DATABASE_ID: "<.env.localのVITE_FIREBASE_DATABASE_IDの値>"
```

2. デプロイコマンドの実行
```bash
gcloud run deploy cafe-search \
  --source . \
  --region asia-northeast1 \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --min-instances 1 \
  --build-env-vars-file env.yaml
```

7.4 ドメイン・APIキー制限設定
1. APIキーのウェブサイト制限 (Google Cloud Console):
   - `https://cafe-search.immersed-in-knowing.com/*`
   - `http://localhost:*`
   ※ Cloud Run デフォルトURLはカスタムドメインへ301リダイレクトされるため、リファラー制限からは除外済み。
2. カスタムドメインマッピング:
   - Cloud Run 画面より `cafe-search.immersed-in-knowing.com` をサービス `cafe-search` にマッピングし、DNS（CNAMEレコード）を設定する。
