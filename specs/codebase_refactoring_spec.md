# コードベースリファクタリング（2026-06）

## 概要
- テンプレートとしての品質向上を目的に、コードベース全体のリファクタリングを行う
- 主な内容は以下の3点 + ドキュメント更新
  1. インポートパスの不統一による実行時バグの修正
  2. `BaseApiClient` の重複コードの集約
  3. `SheetUtils` の重複ロジックの整理
- 背景: インポートパスの問題は「ビルドは成功するが GAS 実行時に壊れる」という発見しづらいバグであり、テンプレート利用者全員に波及するため最優先で修正する

## 仕様

### 機能要件
- 既存の公開インターフェース（クラス名・メソッドシグネチャ・戻り値の形式）は一切変更しない
- 利用側（Operation / DAO / APIクライアントの派生クラス）のコード修正は不要であること
- `npm run build` が成功し、`dist/main.js` に UMD ラッパーや `require(...)` が混入しないこと

### UI/メッセージ
- ユーザー向けUIの変更なし（内部リファクタリングのみ）

### 制約・前提
- 対象ファイル:
  - `src/base_classes/base_operation.js`
  - `src/base_classes/base_sheet_data.js`
  - `src/base_classes/base_api_client.js`
  - `src/utils/sheet_utils.js`
  - `ARCHITECTURE.md`
- ビルド設定（`vite.config.js`）は変更しない

## 実装計画

### 1. インポートパスの修正（バグ修正）

**問題**:
`base_operation.js` と `base_sheet_data.js` が `import { SheetUtils } from "utils/sheet_utils"` とエイリアスなしで記述している。`vite.config.js` で定義されているエイリアスは `@` のみのため、Vite はこのパスを解決できず**外部モジュール**として扱う。結果、ビルドは成功するが `dist/main.js` に UMD ラッパー（`require("utils/sheet_utils")` / `global.sheet_utils` へのフォールバック）が出力され、GAS 実行時に `sheet_utils` が `undefined` となり、`_getNamedRangeColsOf()` / `_getNamedRangesOf()` の呼び出しが実行時エラーになる。

**修正**:

```javascript
// 修正前
import { SheetUtils } from "utils/sheet_utils";

// 修正後
import { SheetUtils } from "@/utils/sheet_utils";
```

**検証**: ビルド後の `dist/main.js` に `require` / UMD ラッパーが含まれず、`SheetUtils` クラス本体がバンドルされていることを確認する。

### 2. `BaseApiClient` の重複排除

**問題**:
`_post` / `_put` / `_patch` / `_delete` の4メソッドが HTTP メソッド名以外完全に同一。また `request()` → `_methods` ゲッター（マッピング + `bind`）→ 各メソッドという間接参照が冗長。

**修正**:
- 4メソッド + `_get` + `_methods` ゲッターを廃止し、単一の `_fetch(method, { path, headers, params, payload })` に集約する
- 分岐は「GET はクエリパラメータを URL に付与、それ以外は JSON ボディを送信」の1箇所のみ
- `request()` の公開インターフェース・戻り値（`{ status, data }`）は変更しない
- `METHODS` 定数のエクスポートも維持する
- バリデーションエラーのメッセージに対象を含める: `'invalid request'` → `` `invalid request: ${endpoint.method} ${endpoint.path}` ``（エンドポイント定義を外出しする利用パターンで、どの定義が不正かを特定しやすくする）

```javascript
_fetch(method, { path, headers = {}, params = {}, payload = {} }) {
  let url = this._buildUrl(path);
  const options = {
    method,
    headers: { ...this._BASE_HEADERS, ...headers },
  };

  if (method === METHODS.GET) {
    const queryString = this._buildQueryString(params);
    if (queryString) {
      url = `${url}?${queryString}`;
    }
  } else {
    options.contentType = 'application/json';
    options.payload = JSON.stringify(payload);
  }

  const res = UrlFetchApp.fetch(url, options);
  return this._serialize(res);
}
```

**効果**: 約80行の削減。HTTP メソッド追加時の修正箇所が1箇所になる。

### 3. `SheetUtils` の重複排除

**問題**:
`getNamedRangeColsOf()` と `getNamedRangesOf()` が「シートの null チェック → `getNamedRanges()` → reduce でオブジェクト化」という同一の走査ロジックを重複して持っている。

**修正**:
`getNamedRangeColsOf()` を `getNamedRangesOf()` の結果から導出する形に書き換える。

```javascript
static getNamedRangeColsOf(sheet) {
  const namedRanges = this.getNamedRangesOf(sheet);
  if(!namedRanges) return null;

  return Object.entries(namedRanges).reduce((acc, [name, range]) => {
    acc[name] = range.getColumn();
    return acc;
  }, {});
}
```

**互換性**: 戻り値の形式（`{name: 列番号}` / 名前付き範囲がない場合は `null`）は従来と同一。

### 4. `BaseOperation.run()` のエラーログ記録

**問題**:
`run()` の catch 節が `throw error` のみで、try/catch を書かない場合と挙動が完全に同一（no-op）。特に時間主導トリガーでの実行時は Web UI のアラートが誰にも見えないため、ログへの明示的な記録が唯一の手がかりになる。

**修正**:
catch 節に `console.error(error)` を1行追加し、再スローはそのまま維持する。

```javascript
run() {
  try {
    return this._operation();
  } catch (error) {
    console.error(error);
    throw error;
  }
}
```

**効果**: 「`_operation()` の処理は必ずラップされる」という設計意図に実質的な意味（実行ログへの確実な記録、将来の通知処理などの差し込み口）が生まれる。

### 5. `ARCHITECTURE.md` の実態合わせ

**問題**:
Webpack + gas-webpack-plugin 前提の記述（実態は Vite）、別プロジェクト名（`spreadsheet-chart-racing`）のディレクトリツリー、エイリアスなしのインポート例が記載されている。AI エージェント向けリファレンスを謳うドキュメントがこの状態のため、ドキュメントに従うと項目1の壊れたインポートが再生産される（実際、既存の壊れたインポートはこの記述に由来すると推測される）。

**修正**:
- 技術スタック・ビルド設定の節を Vite + rollup-plugin-google-apps-script に全面更新
- ディレクトリツリーを実態（`base_api_client.js` 含む）に合わせる
- 全コード例のインポートを `@/` エイリアス形式に統一
- 「インポートパスの規則」を独立した節として追加し、エイリアスなしパスの危険性を明記
- `BaseApiClient` のアーキテクチャパターン解説（2.3節）を追加
- チェックリストに「`@/` エイリアス使用」「`dist/main.js` への UMD 混入確認」を追加

### 処理フロー（作業手順）
1. インポートパス修正（`base_operation.js` / `base_sheet_data.js`）
2. `BaseApiClient` リファクタリング
3. `SheetUtils` リファクタリング
4. `BaseOperation.run()` へのエラーログ追加
5. `ARCHITECTURE.md` 更新
6. `npm run build` 実行、`dist/main.js` の内容検証（UMD ラッパー混入なし・グローバル関数出力あり）

### 技術的な判断・注意点

- **公開インターフェース完全維持**: テンプレートとして既存の派生プロジェクトへの影響をゼロにするため、外から見える振る舞いは一切変えない。重複排除は内部実装のみ
- **`BaseApiClient._serialize()` は今回触らない**: 空ボディ・非JSONレスポンスで `JSON.parse` が例外になる点、`muteHttpExceptions` 未使用のため 4xx/5xx で `UrlFetchApp.fetch` 自体が例外を投げる点は把握しているが、挙動変更を伴うため本リファクタリングのスコープ外とする（将来の改善候補）
- **`BaseOperation` / `BaseSheetData` のシートアクセス系メソッドの重複は許容**: Operation 側にもシートアクセスの利便メソッドを残す方針のため、統合しない
- **`script_properties.js` は現状維持**: テンプレートとして未使用モジュールが存在するのは想定通り。実際に利用する際は `export` の追加が必要になる点のみ留意
- **`BaseApiClient` の利用パターン（エンドポイント定義オブジェクト + `request()`）は完全互換**: `request()` の公開インターフェースを変えていないため、`LINE_API.message.reply({...})` のようなエンドポイント定義ファクトリを `request()` に渡す既存の使用感はそのまま維持される

## 検証結果
- `npm run build` 成功
- `dist/main.js` に `require(...)` / UMD ラッパーの混入なし、`SheetUtils` がバンドルに含まれることを確認
- グローバル関数 `sampleOperation` が従来どおり出力されることを確認
