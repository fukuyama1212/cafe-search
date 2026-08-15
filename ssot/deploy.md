# 本番環境デプロイ手順ガイド (Cloud Run)

## 1. SSOTにおける `.env.local` の記載と注意点

### SSOTでの記載状況

SSOT（v1.3）の **「5.2 セキュリティ・セキュリティルール」** において、以下の通り運用方針が規定されています。

> **APIキーの秘匿と制限**: APIキーはソースコードにハードコードせず環境変数経由で管理する。

### Vite / React アプリにおける環境変数の重要な性質

1. **`.env.local` の位置づけ**:
   `.env.local` は **ローカル開発環境専用** の設定ファイルです。Gitの管理対象外（`.gitignore`）とし、リモートリポジトリ（GitHub等）には絶対にコミットしません。

2. **フロントエンド（Vite）におけるビルド時埋め込み**:
   Vite（React）の `import.meta.env.VITE_*` は、**ビルド時（`npm run build` 実行時）に静的JavaScriptコード内に直接インライン（埋め込み）展開されます**。
   そのため、Cloud Run の実行時環境変数にセットしてもブラウザ側からは参照できません。**Dockerイメージ構築（ビルド）の段階で環境変数を注入する**必要があります。

## 2. デプロイ全体の流れ

```
[ ローカルソースコード ] 
       │
       ├─ ステップ 1: Dockerfile と nginx 設定の作成
       │
       ├─ ステップ 2: env.yaml の作成と Cloud Run へデプロイ
       │    （ビルド時に VITE_* 環境変数を注入）
       │
       ├─ ステップ 3: Google Cloud APIキーのリファラー制限設定
       │
       └─ ステップ 4: カスタムドメイン (cafe-search.immersed-in-knowing.com) 設定
```

## 3. 詳細手順

### ステップ 1: プロジェクトルートに設定ファイルを作成

Cloud Run で React SPA を「Scale to Zero（アクセスが無いときはインスタンス0）」で超低コスト運用するため、**Nginx（軽量Webサーバー）を使ったマルチステージDockerビルド** を行います。

#### ① Nginx 設定ファイルの作成 (`nginx.conf`)

プロジェクトルートに `nginx.conf` を作成します。（React Router などの SPA ルーティングで `404` が発生するのを防止します）

```nginx
server {
    listen 8080;
    server_name localhost;

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

#### ② Dockerfile の作成 (`Dockerfile`)

プロジェクトルートに `Dockerfile` を作成します。

```dockerfile
# --- Stage 1: Build Stage ---
FROM node:24-alpine AS build
WORKDIR /app

# パッケージ定義のコピーとインストール
COPY package*.json ./
RUN npm ci

# ビルド時環境変数の定義 (Vite用)
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

# ソースコードのコピーとビルド
COPY . .
RUN npm run build

# --- Stage 2: Production Stage ---
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
```

### ステップ 2: Cloud Run へのビルド＆デプロイ実行

Google Cloud SDK (`gcloud` CLI) で `--build-env-vars-file` を使用する際は YAML 形式が必要となります。

1. ルートディレクトリに `env.yaml` を作成します（`.gitignore` に記載してください）：

```yaml
VITE_GOOGLE_MAPS_API_KEY: "ご自身のGoogle Maps APIキー"
VITE_FIREBASE_API_KEY: "AIzaSyBtDLb9zgIZj7-fVvmKolz3dvLc73gXc0s"
VITE_FIREBASE_AUTH_DOMAIN: "cafe-search-202608.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID: "cafe-search-202608"
VITE_FIREBASE_STORAGE_BUCKET: "cafe-search-202608.firebasestorage.app"
VITE_FIREBASE_MESSAGING_SENDER_ID: "678473793429"
VITE_FIREBASE_APP_ID: "1:678473793429:web:a50c9bc58efd1bc387009c"
VITE_FIREBASE_MEASUREMENT_ID: "G-P4E0LHDJ6Q"
```

2. ターミナルで以下のコマンドを実行してデプロイします：

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

### ステップ 3: Google Cloud APIキーのリファラー制限を本番用に設定

デプロイ完了後、Cloud Run から発行されたURL（例: `https://cafe-search-678473793429.asia-northeast1.run.app`）または本番ドメインでのアクセスを許可します。

1. [Google Cloud Console - 認証情報](https://console.cloud.google.com/apis/credentials) を開きます。

2. アプリで使用している API キー（`VITE_GOOGLE_MAPS_API_KEY` および `VITE_FIREBASE_API_KEY`）をクリックします。

3. **「ウェブサイトの制限」** に以下を追加します：

   * `https://cafe-search.immersed-in-knowing.com/*`（本番カスタムドメイン）

   * `https://*.asia-northeast1.run.app/*`（Cloud Runデフォルトドメイン）

   * `http://localhost:*`（開発用）

4. **「保存」** をクリックします。

### ステップ 4: カスタムドメインのマッピング設定

SSOTで指定された対象ドメイン `cafe-search.immersed-in-knowing.com` を Cloud Run に紐付けます。

1. [Google Cloud Console - Cloud Run](https://console.cloud.google.com/run) を開きます。

2. 画面上部の **「カスタムドメインの管理」** をクリックします。

3. **「マッピングを追加」** を選択し、サービス `cafe-search` とドメイン `cafe-search.immersed-in-knowing.com` を選択します。

4. 画面に表示される **DNS レコード（CNAMEレコード等）** を、お使いのドメイン管理サービス（お名前.com、Cloudflare等）のDNS設定に登録します。

5. SSL証明書の自動発行が完了するまで数分〜数十分待ちます。

## 4. デプロイ後の動作確認チェックリスト

* [ ] 本番URL（またはCloud Run生成URL）にアクセスしてトップ画面が表示されるか？
* [ ] ブラウザのデベロッパーツール（F12 > Console）にエラーが発生していないか？
* [ ] Firestore からカフェのリストデータが問題なくロードされるか？
* [ ] 地図（Google Maps）がエラーなく描画されるか？