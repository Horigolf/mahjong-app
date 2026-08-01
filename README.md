# 麻雀 Web アプリ

Next.js + Supabase で動く、知り合い同士向けの麻雀対局アプリです。

## Getting Started

```bash
npm install
cp .env.local.example .env.local
# .env.local に値を記入してから:
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## 環境変数

`.env.local`（ローカル）または Vercel の **Project Settings → Environment Variables** に設定します。  
`.env.local` は `.gitignore` で除外されています。リポジトリにコミットしないでください。

| 変数名 | 必須 | 公開範囲 | 説明 |
|--------|------|----------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | 必須 | ブラウザにも露出 | Supabase Project URL（末尾に `/rest/v1/` は付けない） |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 必須 | ブラウザにも露出 | Supabase anon / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | 必須（サーバー） | **サーバーのみ** | service_role 秘密鍵。Vercel でも設定する。ブラウザや `NEXT_PUBLIC_*` には載せない |
| `ADMIN_USER_NAMES` | 任意 | **サーバーのみ** | 管理画面（`/admin`）を使える表示名。カンマ区切り（例: `堀`） |

値の取得先: [Supabase Dashboard](https://supabase.com/dashboard) → 対象プロジェクト → **Project Settings → API**

サンプルは `.env.local.example` を参照してください。

## Deploy on Vercel

1. GitHub 等にリポジトリを push（`.env.local` は含まれないことを確認）
2. [Vercel](https://vercel.com/new) でリポジトリをインポート
3. 上記の環境変数を Production / Preview に設定
4. Deploy

Edge Functions（打牌・和了など）は Supabase 側に別途デプロイが必要です（`supabase functions deploy ...`）。  
CORS は現在 `Access-Control-Allow-Origin: *` のため、`*.vercel.app` からも Edge Functions を呼び出せます。

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
