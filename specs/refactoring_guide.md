# gas-development-template-2 リファクタリング改修指示書

作成日: 2026-06-13
対象ブランチ: `claude/vibrant-davinci-3zqtuu`（ローカルコミット `fdffd5e`、push 権限の問題により未プッシュ）

このドキュメントは、リファクタリングで「どのファイルに」「どんな改修をするべきか」をまとめたものです。
添付のパッチファイル（`0001-refactor-ARCHITECTURE.md.patch`）を `git am` で適用すれば、以下の全変更を一括で取り込めます。

```bash
git checkout -b refactoring development  # 任意のブランチで
git am 0001-refactor-ARCHITECTURE.md.patch
npm run build  # 検証
```

---

## 改修一覧（サマリー）

| # | ファイル | 種別 | 内容 |
|---|---------|------|------|
| 1 | `src/base_classes/base_operation.js` | **バグ修正** | インポートパスを `@/` エイリアスに修正 |
| 1 | `src/base_classes/base_sheet_data.js` | **バグ修正** | 同上 |
| 2 | `src/base_classes/base_api_client.js` | リファクタリング | HTTP メソッド別の重複コードを単一の `_fetch` に集約 |
| 3 | `src/utils/sheet_utils.js` | リファクタリング | `getNamedRangeColsOf` を `getNamedRangesOf` から導出 |
| 4 | `src/base_classes/base_operation.js` | 改善 | `run()` の catch に `console.error` を追加 |
| 5 | `ARCHITECTURE.md` | ドキュメント | Webpack 前提の記述を Vite の実態に全面更新 |
| 6 | `specs/codebase_refactoring_spec.md` | ドキュメント | 本リファクタリングの詳細設計書を新規作成 |

---

## 1. インポートパスの修正【最優先・実バグ】

**ファイル**: `src/base_classes/base_operation.js`(1行目) / `src/base_classes/base_sheet_data.js`(1行目)

**問題**:
`vite.config.js` に定義されているエイリアスは `@`（→ `./src`）のみ。エイリアスなしの
`"utils/sheet_utils"` は Vite が解決できず**外部モジュール**として扱われる。
その結果、**ビルドは成功する**のに `dist/main.js` には `require("utils/sheet_utils")` を含む
UMD ラッパーが出力され、GAS 実行時に `sheet_utils` が `undefined` となり、
`_getNamedRangeColsOf()` / `_getNamedRangesOf()` を呼んだ瞬間に実行時エラーになる。

**改修**:

```javascript
// 修正前（両ファイル共通）
import { SheetUtils } from "utils/sheet_utils";

// 修正後
import { SheetUtils } from "@/utils/sheet_utils";
```

**検証方法**: ビルド後の `dist/main.js` に `require(` が含まれず、`class SheetUtils` 本体が
バンドルされていること。ビルドログの変換モジュール数が 4 → 5 に増えることでも確認できる。

---

## 2. `BaseApiClient` の重複排除

**ファイル**: `src/base_classes/base_api_client.js`

**問題**:
`_post` / `_put` / `_patch` / `_delete` の4メソッドが HTTP メソッド名以外完全に同一。
さらに `request()` → `_methods` ゲッター（マッピング + `bind`）→ 各メソッドという間接参照が冗長。

**改修**:
`_get` / `_post` / `_put` / `_patch` / `_delete` / `_methods` の6メンバーを削除し、
単一の `_fetch(method, { path, headers, params, payload })` に置き換える。
`request()` は `this._methods[endpoint.method]({...})` の代わりに `this._fetch(endpoint.method, {...})` を呼ぶ。

```javascript
/**
 * HTTPリクエストを実行する。GETはクエリパラメータ、それ以外はJSONボディを送信する。
 * @param {string} method - HTTPメソッド（METHODSのいずれか）
 * @param {Object} params
 * @param {string} params.path - パス
 * @param {Object} [params.headers] - 追加ヘッダー
 * @param {Object} [params.params] - クエリパラメータ（GETのみ使用）
 * @param {Object} [params.payload] - リクエストボディ（GET以外で使用）
 * @returns {Object} レスポンス { status, data }
 * @private
 */
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

**あわせて行う改善**:
バリデーションエラーのメッセージに対象エンドポイントを含める。

```javascript
// 修正前
throw new Error('invalid request');

// 修正後
throw new Error(`invalid request: ${endpoint.method} ${endpoint.path}`);
```

エンドポイント定義をデータとして外出しする利用パターンでは、どの定義が不正だったのかを
メッセージだけで特定できるようになる。

**互換性（重要）**:
- `request({ method, path, headers, params, payload })` の公開インターフェース・
  戻り値（`{ status, data }`）・`METHODS` 定数のエクスポートは**一切変更しない**
- そのため、エンドポイント定義オブジェクトのファクトリ（例: `LINE_API.message.reply({...})`）を
  `request()` に渡す既存の利用パターンは**無修正でそのまま動く**

**スコープ外として見送ったもの（将来の改善候補）**:
- `_serialize()` は空ボディ・非JSONレスポンスで `JSON.parse` が例外になる
- `muteHttpExceptions` 未使用のため 4xx/5xx では `UrlFetchApp.fetch` 自体が例外を投げ、
  `{ status, data }` 形式が活きない
- いずれも挙動変更を伴うため今回は触っていない

---

## 3. `SheetUtils` の重複排除

**ファイル**: `src/utils/sheet_utils.js`

**問題**:
`getNamedRangeColsOf()` と `getNamedRangesOf()` が「null チェック → `getNamedRanges()` →
reduce でオブジェクト化」という同一の走査ロジックを二重に持っている。

**改修**: `getNamedRangeColsOf()` を `getNamedRangesOf()` の結果から導出する。

```javascript
// 修正後
static getNamedRangeColsOf(sheet) {
  const namedRanges = this.getNamedRangesOf(sheet);
  if(!namedRanges) return null;

  // {name: rangeCol} 形式のオブジェクトにして返す
  return Object.entries(namedRanges).reduce((acc, [name, range]) => {
    acc[name] = range.getColumn();
    return acc;
  }, {});
}
```

**互換性**: 戻り値の形式（`{name: 列番号}`、名前付き範囲がない場合は `null`）は従来と同一。

---

## 4. `BaseOperation.run()` のエラーログ記録

**ファイル**: `src/base_classes/base_operation.js`

**問題**:
catch 節が `throw error` のみで、try/catch を書かない場合と挙動が完全に同一（no-op）。
特に時間主導トリガーでの実行時は Web UI のアラートが誰にも見えないため、
ログへの明示的な記録が唯一の手がかりになる。

**改修**: catch 節に `console.error(error)` を1行追加。再スローは維持。

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

これにより「`_operation()` は必ずラップされる」という設計意図に実質的な意味
（実行ログへの確実な記録、将来の通知処理などの差し込み口）が生まれる。

---

## 5. `ARCHITECTURE.md` の実態合わせ【全面更新】

**問題**: AI エージェント向けリファレンスを謳うドキュメントが実態と乖離しており、
これに従うと改修1の壊れたインポートが再生産される（既存バグの根本原因と推測される）。

**主な変更点**:

| 節 | 変更内容 |
|----|---------|
| 1.1 技術スタック | Webpack + gas-webpack-plugin → **Vite + rollup-plugin-google-apps-script** |
| 1.2 プロジェクト構造 | 別プロジェクト名（`spreadsheet-chart-racing`）のツリー → 実際の構成（`base_api_client.js` 含む）に差し替え |
| 1.3 **（新設）** | 「インポートパスの規則」: `@/` エイリアス必須、エイリアスなしパスは「ビルドは通るが GAS 実行時に壊れる」ことを良い例/悪い例付きで明記 |
| 2.3 **（新設）** | `BaseApiClient` のアーキテクチャパターン解説（`_BASE_URL` / `_BASE_HEADERS` のオーバーライド、`request()` の使い方、`METHODS` 定数の利用） |
| 2.1 | `BaseOperation` のメソッド表に `_elapsedMinutesFrom` を追加 |
| 3, 6.3, 9.x | 全コード例のインポートを `@/` エイリアス形式に統一 |
| 5.1 | ファイル名規則に APIクライアント（`_api_client.js`）を追加 |
| 7.1 | エラーハンドリング方針を実装と一致させる（`run()` が `console.error` で記録して再スロー） |
| 8 | Webpack 設定の節 → Vite 設定の節（`minify: false` 変更禁止の理由、`@/` エイリアス、`dist/` と clasp の関係） |
| 10 | チェックリストに「`@/` エイリアス使用」「`dist/main.js` への UMD 混入確認」を追加 |

全文はパッチファイルに含まれる。

---

## 6. `specs/codebase_refactoring_spec.md` の新規作成

`specs/_template.md` の形式に沿った本リファクタリングの詳細設計書。
上記1〜5の問題・修正・互換性の判断に加え、**スコープ外とした判断**も記録している:

- `script_properties.js`: テンプレートとして未使用モジュールの存在は想定通り → 現状維持
  （実際に利用する際は `export` の追加が必要になる点のみ留意）
- `BaseOperation` / `BaseSheetData` のシートアクセス系メソッドの重複: Operation 側にも
  利便メソッドを残す方針のため統合しない
- `BaseApiClient._serialize()` の堅牢化: 挙動変更を伴うため見送り（改修2の項を参照）

---

## 検証結果（実施済み）

- `npm run build` 成功（5 モジュール変換、`dist/main.js` 6.47 kB）
- `dist/main.js` に外部依存の `require(...)` なし、`SheetUtils` がバンドルに含まれることを確認
- グローバル関数 `sampleOperation` が従来どおり出力されることを確認
- `console.error(error)` がバンドルに含まれることを確認
