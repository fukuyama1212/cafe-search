# デプロイコマンド
```
gcloud run deploy cafe-search --source . --region asia-northeast1 --platform managed --allow-unauthenticated --port 8080 --min-instances 1 --set-build-env-vars "VITE_GOOGLE_MAPS_API_KEY=AIzaSyAyzT2rL9ln2ztZUNqh1NcMhfRW3hLtVaY,VITE_FIREBASE_API_KEY=AIzaSyBtDLb9zgIZj7-fVvmKolz3dvLc73gXc0s,VITE_FIREBASE_AUTH_DOMAIN=cafe-search-202608.firebaseapp.com,VITE_FIREBASE_PROJECT_ID=cafe-search-202608,VITE_FIREBASE_STORAGE_BUCKET=cafe-search-202608.firebasestorage.app,VITE_FIREBASE_MESSAGING_SENDER_ID=678473793429,VITE_FIREBASE_APP_ID=1:678473793429:web:a50c9bc58efd1bc387009c,VITE_FIREBASE_MEASUREMENT_ID=G-P4E0LHDJ6Q,VITE_FIREBASE_DATABASE_ID=cafe-search"
```



```
gcloud run deploy cafe-search --source . --region asia-northeast1 --platform managed --allow-unauthenticated --port 8080 --min-instances 1
```

```
gcloud run deploy cafe-search --source . --region asia-northeast1 --platform managed --allow-unauthenticated --port 8080 --min-instances 1gcloud run deploy cafe-search --source . --region asia-northeast1 --platform managed --allow-unauthenticated --port 8080 --min-instances 1 --build-env-vars-file .env.local
```

```
gcloud run deploy cafe-search --source . --region asia-northeast1 --platform managed --allow-unauthenticated --port 8080 --min-instances 1 --build-env-vars-file .env.local
```


```
$envVars = (Get-Content .env.local | Where-Object { $_ -match '=' -and $_ -notmatch '^#' }) -join ','; gcloud run deploy cafe-search --source . --region asia-northeast1 --platform managed --allow-unauthenticated --port 8080 --min-instances 1 --set-build-env-vars $envVars
```


# 最終的なデプロイコマンド
```
npm run build; gcloud run deploy cafe-search --source . --region asia-northeast1 --platform managed --allow-unauthenticated --port 8080 --min-instances 1
```