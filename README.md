# 最終的なデプロイコマンド
```
npm run build; gcloud run deploy cafe-search --source . --region asia-northeast1 --platform managed --allow-unauthenticated --port 8080 --min-instances 1
```

# カフェDB更新コマンド
```
npx tsx scripts/fetch-places.ts
```