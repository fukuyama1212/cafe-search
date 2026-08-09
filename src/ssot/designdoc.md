```
Markdownテキストを、Canvas上で自動レンダリングさせず、「プレーンテキスト（Text）」または「Markdownファイル」のソースコード枠として出力してください。
Canvasが勝手にリッチテキストに変換するのを防ぐため、コードブロック全体の囲みにはバッククォート4つ（````）を使用し、言語指定を「text」にしてください。 
```

要件定義書 兼 基本設計書（SSOT v1.3）

プロジェクト概要 (Project Overview)

・プロジェクト名: Cafe-Search (仮称)
・目的: PC作業や勉強を重視するリモートワーカー・学習者向けに、「作業環境（電源・Wi-Fi）」と「空間の魅力（おしゃれさ）」を両立したカフェを直感的に探せるスワイプ型マッチングWebアプリケーションを提供する。
・アーキテクチャ方針: AI駆動開発（AI-Driven Development）を採用。本ドキュメントをシステム全体のSSOT（Single Source of Truth）として運用する。
・対象ドメイン: cafe-search.immersed-in-knowing.com

システムアーキテクチャ・技術スタック (System Architecture & Tech Stack)

2.1 基本技術スタック & 実行環境
・Node.js: v24.19.0
・ビルドツール: Vite (v8.x)
・フロントエンド: React (TypeScript / React-TS)
・CSSフレームワーク: Tailwind CSS (v3.x) + PostCSS + Autoprefixer
・アイコンライブラリ: lucide-react
・バージョン管理: Git / GitHub（トークン認証・リモートリポジトリ設定済み）

2.2 インフラ構成 (Google Cloud Platform)
・フロントエンドホスティング: Cloud Run (Scale to Zero による低コスト運用)
・データベース: Firestore (Standard Edition / ネイティブモード / asia-northeast1 東京)
・バッチ処理: Cloud Run Jobs + Cloud Scheduler

2.3 地図描画・API連携
・地図描画: Google Maps JavaScript API (Dynamic Maps)
・地図コスト戦略（マップ保持設計）:
アプリのルーティング遷移（タブ/画面切り替え）において地図コンポーネントを再読み込み（再マウント）させないSPAアーキテクチャを採用する。地図インスタンスを一度生成した後は裏側に保持（表示/非表示のCSS制御など）し、無駄なAPI再読み込みと課金を防止・最小化する。

画面構成と機能要件 (Screens & Functional Requirements)

3.1 画面構成 (SPA内ルーティング)
・TopScreen: エリア選択（すべて/渋谷/新宿）、Google Maps表示（Like済みピン連携）、スワイプ画面への遷移動線。
・SwipeScreen: Tinder風のカードスタックUI。物理的なドラッグ/タッチ操作による Like / Dislike 判定。
・ListScreen: Likeしたカフェの一覧表示および「食べログ」外部動的リンクへの導線。

3.2 機能要件
・F1. スワイプマッチングUI: カードスタックUI、物理的なドラッグ/タッチ操作によるLike/Dislike判定。
・F2. 行きたいカフェマップ (My Map): Likes（保存済み）のカフェを地図上にピン留め表示。
・F3. 食べログ動的リンク生成: 離脱防止のため別タブ(target="_blank")で遷移。https://tabelog.com/rst/rstsearch/?keyword={店舗名}+{エリア名} の動的URLを生成。
・F4. データ永続化: ユーザー登録を行わず、ブラウザの localStorage を使用してLike/Dislike履歴を保持。

データ設計 (Data Schema - Firestore)

Firestoreのデータベース構造は以下の通り定義する。

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
・説明: 店舗画像の公開URL配列。カードおよび一覧画像のメイン表示に使用。

【9】scores
・型: map (object)
・必須: ○
・説明: 独自スコア構造体

workability: number (1.0〜5.0 / 作業適性スコア)

stylishness: number (1.0〜5.0 / おしゃれ度スコア)

【10】features
・型: map (object)
・必須: ○
・説明: 設備フラグ構造体

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

非機能要件 (Non-Functional Requirements)

5.1 パフォーマンス・コスト最適化
・SPA Map Persistence:
地図描画は「1セッションにつき1回の読み込み」を原則とする。トップ画面遷移時に地図を再生成しない実装を必須とする。
・スケーリング対策:
月間28,500回（無料枠）を超過するトラフィックが発生した場合、以下の優先順位でコスト最適化を図る。

Maps Static APIへの移行: 静止画マップへ切り替え、APIコストを大幅低減。

Mapboxへの移行: 50,000回まで無料枠がある代替サービスへの乗り換え検討。

5.2 セキュリティ・セキュリティルール
・APIキーの秘匿と制限: APIキーはソースコードにハードコードせず環境変数経由で管理する。
・HTTP リファラー制限: https://cafe-search.immersed-in-knowing.com/* および開発環境のみにアクセスを限定。
・API 制限: 「Maps JavaScript API」のみを許可し、他APIの不正利用を防止する。
・Firestore Security Rules:
デフォルト「限定的」で作成後、Webアプリからの読み取り（read）のみを許可し、クライアントからの直接書き込み（write）は禁止（書き込みは管理用/バッチのGCPコンテキストのみ許可）に設定する。

コンプライアンス・制約事項

・Tabelog制約: 食べログデータのスクレイピングは一切不可。https://tabelog.com/rst/rstsearch/?keyword={店舗名}+{エリア名} の動的URL生成による直リンク遷移（target="_blank"）のみで実装すること。
・AI運用: 実装時は本SSOTを必ず遵守すること。