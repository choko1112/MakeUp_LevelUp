# StepLog

自己研鑽の「今日やること」「TODO」「活動日記」を一か所にまとめ、将来的にAIから取り組みのアドバイスを受け取るためのWebアプリです。

現在は共同開発の土台となる初期版です。入力内容はブラウザの `localStorage` に保存されます。データベース、ログイン、AI API接続は今後の実装範囲です。

## セットアップ

Python 3.12 以上を推奨します。

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload
```

ブラウザで <http://127.0.0.1:8000> を開いてください。

## テスト

```powershell
pip install -r requirements-dev.txt
pytest
```

## 構成

```text
main.py                 FastAPIのエントリーポイントとAPI
templates/index.html    メイン画面
static/css/app.css      デザイン・レスポンシブ対応
static/js/app.js        画面操作とブラウザ内保存
tests/                  APIのテスト
```

## Vercelへの公開

Vercelはルートの `main.py` にあるFastAPIの `app` を自動検出できます。GitHubリポジトリをVercelへ接続すると、ブランチごとのプレビューと `main` ブランチの本番公開が利用できます。

AI APIキーなどの秘密情報はGitへコミットせず、VercelのEnvironment Variablesへ設定してください。必要な変数名は `.env.example` に追加してチームで共有します。

## 今後の主な実装候補

- データベースとユーザー認証
- TODOの編集・期限・並び替え
- 日ごとの目標と活動日記の履歴
- AI APIによる振り返り分析とアドバイス
- 入力中、保存成功、通信失敗などの状態表示
