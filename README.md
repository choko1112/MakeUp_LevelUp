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

日付別保存とデータ引き継ぎのテストは、Node.jsで `node --test tests/storage.test.cjs` を実行します。

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

## カレンダーで振り返る

ヘッダーの「カレンダー」から `/calendar` を開き、日付を選ぶと、その日のTODO（完了・未完了）、フォーカスの達成状況、保存済みの活動日記を確認できます。前月・翌月の移動と「今日」に戻る操作に対応しています。

記録はブラウザーのローカル日付ごとに `localStorage` の `steplog:v2` に保存します。日付が変わると新しい日の入力に切り替わり、過去の記録は残ります。以前の `steplog:v1` の記録は日付情報を持たないため、初回読み込み日の記録として引き継ぎ、元データは残します。ブラウザー・端末・アクセス先（ポートを含む）が異なると記録は共有されません。

## 今後の主な実装候補

- データベースとユーザー認証
- TODOの編集・期限・並び替え
- AI APIによる振り返り分析とアドバイス
- 入力中、保存成功、通信失敗などの状態表示
