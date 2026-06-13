# アーキテクチャ・コーディングスタイル仕様書

本ドキュメントは、AIエージェントがこのコードベースと一貫したスタイルでコードを書くための詳細なリファレンスです。

---

## 1. プロジェクト概要

### 1.1 技術スタック
- **ランタイム**: Google Apps Script (GAS)
- **開発言語**: JavaScript (ES6+ / ES Modules)
- **ビルドツール**: Vite + rollup-plugin-google-apps-script
- **デプロイ**: clasp (Google Apps Script CLI)

### 1.2 プロジェクト構造

```
gas-development-template-2/
├── src/
│   ├── index.js              # エントリーポイント（グローバル関数定義）
│   ├── constants.js          # 定数定義
│   ├── script_properties.js  # GASスクリプトプロパティ管理
│   ├── base_classes/         # 基底クラス
│   │   ├── base_operation.js
│   │   ├── base_sheet_data.js
│   │   └── base_api_client.js
│   ├── operations/           # ユーザー操作クラス
│   ├── sheet_data/           # DAOクラス（必要に応じて作成）
│   └── utils/                # ユーティリティ
├── specs/                    # 機能仕様書
├── dist/                     # ビルド成果物（main.js + appsscript.json）
├── appsscript.json           # GASマニフェスト（ビルド時に dist/ へコピーされる）
├── vite.config.js
└── package.json
```

### 1.3 インポートパスの規則（重要）

**`src/` 配下のモジュールは、必ず `@/` エイリアスを使ってインポートします。**
`@` は `vite.config.js` で `./src` に解決されるよう定義されています。

```javascript
// ✅ 良い例
import { BaseOperation } from "@/base_classes/base_operation";
import { SheetUtils } from "@/utils/sheet_utils";

// ❌ 悪い例（Vite が解決できず、ビルドは通るが GAS 実行時に壊れる）
import { BaseOperation } from "base_classes/base_operation";
import { SheetUtils } from "utils/sheet_utils";
```

エイリアスなしの相対形式（`"utils/sheet_utils"` など）は Vite に「外部モジュール」として扱われ、エラーにならないままバンドルから欠落します。必ず `@/` を付けてください。

---

## 2. アーキテクチャパターン

### 2.1 Operationパターン（Template Method）

ユーザーの1操作（メニュー項目など）は1つの `Operation` クラスに対応させます。

```javascript
// src/operations/xxx_operation.js
import { BaseOperation } from "@/base_classes/base_operation";

export class XxxOperation extends BaseOperation {
  /**
   * このオペレーションのメイン処理
   * @returns {any} 処理結果（必要に応じて）
   */
  _operation() {
    // 具体的な処理をここに実装
  }

  /**
   * 内部ヘルパーメソッド（プライベート）
   * @param {Object} params パラメータ
   * @returns {any}
   * @private
   */
  _helperMethod(params) {
    // ヘルパー処理
  }
}
```

#### BaseOperation が提供するメソッド

| メソッド | 説明 |
|---------|------|
| `run()` | 公開メソッド。エラーハンドリングを含むラッパー。直接変更しない |
| `_operation()` | **オーバーライド必須**。具体的なロジックを実装 |
| `_getSpreadsheet()` | アクティブなスプレッドシートを取得（キャッシュあり） |
| `_getSheet(sheetName)` | 指定名のシートを取得（キャッシュあり） |
| `_getNamedRangeColsOf(sheet)` | シートの名前付き範囲の列番号を取得 |
| `_getNamedRangesOf(sheet)` | シートの名前付き範囲オブジェクトを取得 |
| `_elapsedMinutesFrom(date)` | 指定日時からの経過分数を取得 |
| `_printProgress(index, length)` | 進捗をコンソール出力 |
| `_setNewTrigger(functionName, minutes)` | 時間ベースのトリガーを設定 |

### 2.2 DAOパターン（Data Access Object）

スプレッドシートへのデータアクセスは、`sheet_data/` 内のDAOクラス経由で行います。
バインドされたスプレッドシートを扱う場合は `BoundSheetData` を継承します。

```javascript
// src/sheet_data/xxx_data.js
import { BoundSheetData } from "@/base_classes/base_sheet_data";
import { BOUND_SHEETS, NAMED_RANGES } from "@/constants";

export class XxxData extends BoundSheetData {
  /**
   * 全データを取得（キャッシュ付き）
   * @returns {Array<Object>} フリーズされたオブジェクトの配列
   */
  static get all() {
    const get = () => {
      const sheet = this._getSheet(BOUND_SHEETS.XXX);
      if (!sheet) return [];

      const data = sheet.getDataRange().getValues().slice(1).filter(row => row[0]);
      const namedRangeCols = this._getNamedRangeColsOf(sheet);

      return data.map((row) => {
        return Object.freeze({
          field1: row[namedRangeCols[NAMED_RANGES.BOUND_SHEETS.XXX.FIELD1] - 1],
          field2: row[namedRangeCols[NAMED_RANGES.BOUND_SHEETS.XXX.FIELD2] - 1],
        });
      });
    };

    this._allCache = this._allCache || get();
    return this._allCache;
  }
}
```

#### DAOクラスの規則

1. **静的クラス**: インスタンス化せず、静的メソッドのみ使用
2. **キャッシュ**: `_xxxCache` パターンで結果をキャッシュ
3. **不変オブジェクト**: 取得データは `Object.freeze()` で不変化
4. **名前付き範囲**: 列の取得には名前付き範囲を使用し、ハードコーディングしない

### 2.3 APIクライアントパターン

外部APIの呼び出しは `BaseApiClient` を継承したクラスで行います。
ベースURLと共通ヘッダーをオーバーライドし、エンドポイント定義を `request()` に渡します。

```javascript
// src/api_clients/xxx_api_client.js
import { BaseApiClient, METHODS } from "@/base_classes/base_api_client";

export class XxxApiClient extends BaseApiClient {
  get _BASE_URL() {
    return 'https://api.example.com';
  }

  get _BASE_HEADERS() {
    return { Authorization: `Bearer ${this._token}` };
  }

  /**
   * ユーザー一覧を取得する
   * @returns {Object} レスポンス { status, data }
   */
  fetchUsers() {
    return this.request({
      method: METHODS.GET,
      path: '/users',
      params: { limit: 100 },
    });
  }
}
```

#### BaseApiClient の規則

1. `_BASE_URL` / `_BASE_HEADERS` のオーバーライドは**必須**
2. リクエストは `request({ method, path, headers, params, payload })` で実行する
3. `method` は `METHODS` 定数（`METHODS.GET` など）を使用し、文字列をハードコーディングしない
4. GET はクエリパラメータ（`params`）、それ以外は JSON ボディ（`payload`）を送信する
5. レスポンスは `{ status, data }` 形式（`data` はパース済みJSON）

### 2.4 ユーティリティパターン

汎用的な処理は `utils/` に静的クラスとして配置します。

```javascript
// src/utils/xxx_utils.js
export class XxxUtils {
  /**
   * ユーティリティメソッド
   * @param {Type} param 説明
   * @returns {ReturnType} 説明
   * @throws {Error} エラー条件
   */
  static utilityMethod(param) {
    // バリデーション
    if (!param) throw new Error("エラーメッセージ");

    // 処理
    return result;
  }
}
```

---

## 3. エントリーポイント（index.js）

グローバル関数は `index.js` で `global.xxx = ...` の形式で定義し、対応する Operation をインスタンス化して `.run()` を呼ぶだけにします。
`rollup-plugin-google-apps-script` が `global` への代入を検出し、GAS から呼び出せるトップレベル関数として出力します。

```javascript
// src/index.js
import { XxxOperation } from "@/operations/xxx_operation";

// グローバル関数の命名: xxxOperation（camelCase + Operation）
global.xxxOperation = () => {
  const operation = new XxxOperation();
  operation.run();
};

// 複数の Operation を組み合わせる場合
global.getComplexData = () => {
  const data1 = new GetDataOperation1().run();
  const data2 = new GetDataOperation2().run();
  return {
    data1: data1,
    data2: data2,
  };
};
```

---

## 4. 定数管理（constants.js）

マジックナンバーや文字列を避け、全て定数化します。

```javascript
// src/constants.js
export const BOUND_SHEETS = {
  DATA: 'data',           // シート名（小文字）
  CONFIG: 'config',
};

export const NAMED_RANGES = {
  BOUND_SHEETS: {
    DATA: {
      MONTH: 'DATA.MONTH',       // 名前付き範囲名
      CATEGORY: 'DATA.CATEGORY',
    },
  },
};

export const ERROR_TYPES = {
  VALIDATION: 'ValidationError',
  NOT_FOUND: 'NotFoundError',
};
```

---

## 5. 命名規則

### 5.1 ファイル名

| 種類 | 形式 | 例 |
|------|------|-----|
| Operation | `snake_case` + `_operation.js` | `transform_data_operation.js` |
| DAO | `snake_case` + `_data.js` | `data_sheet_data.js` |
| APIクライアント | `snake_case` + `_api_client.js` | `slack_api_client.js` |
| Utils | `snake_case` + `_utils.js` | `date_utils.js` |
| 基底クラス | `base_` + `snake_case` | `base_operation.js` |

### 5.2 クラス名・関数名・変数名

| 種類 | 形式 | 例 |
|------|------|-----|
| クラス | `PascalCase` | `TransformDataOperation`, `DataSheetData` |
| メソッド（公開） | `camelCase` | `run()`, `getAll()` |
| メソッド（非公開） | `_camelCase` | `_operation()`, `_helperMethod()` |
| 変数 | `camelCase` | `rawData`, `aggregationMap` |
| 定数 | `UPPER_SNAKE_CASE` | `BOUND_SHEETS`, `ERROR_TYPES` |
| グローバル関数 | `camelCase` + `Operation` | `transformDataOperation` |

---

## 6. コーディングスタイル

### 6.1 基本フォーマット

```javascript
// インデント: スペース2つ
// セミコロン: 文末に付ける
// 行末スペース: なし

export class ExampleClass {
  constructor() {
    this.value = null;
  }

  _exampleMethod({ param1, param2 }) {
    if (!param1) return null;

    const result = param1 + param2;
    return result;
  }
}
```

### 6.2 JSDocコメント（必須）

全ての新規クラスと公開メソッドにJSDocを記述します。

```javascript
/**
 * クラスの説明（1行）
 */
export class ClassName {
  /**
   * メソッドの説明
   * @param {string} param1 パラメータ1の説明
   * @param {number} [param2=0] オプションパラメータ（デフォルト値あり）
   * @returns {Object} 返り値の説明
   * @throws {Error} エラー発生条件
   */
  methodName(param1, param2 = 0) {
    // 実装
  }
}
```

### 6.3 インポート順序

```javascript
// 1. 基底クラス
import { BaseOperation } from "@/base_classes/base_operation";

// 2. DAO
import { DataSheetData } from "@/sheet_data/data_sheet_data";

// 3. ユーティリティ
import { SheetUtils } from "@/utils/sheet_utils";

// 4. 定数
import { BOUND_SHEETS, NAMED_RANGES } from "@/constants";
```

### 6.4 キャッシュパターン

GASのAPI呼び出しは遅いため、結果をキャッシュします。

```javascript
// インスタンスキャッシュ（Operation内）
_getSpreadsheet() {
  this._spreadsheetCache = this._spreadsheetCache || SpreadsheetApp.getActiveSpreadsheet();
  return this._spreadsheetCache;
}

// 静的キャッシュ（DAO内）
static get all() {
  const get = () => {
    // データ取得処理
  };
  this._allCache = this._allCache || get();
  return this._allCache;
}
```

---

## 7. エラーハンドリング

### 7.1 基本方針

- **ユーザー向けエラー**: `SpreadsheetApp.getUi().alert()` で表示
- **予期せぬ例外**: `BaseOperation.run()` の try/catch で捕捉し、`console.error` で実行ログに記録した上で再スローする。`_operation()` 内に網羅的な try/catch を書く必要はない
- **バリデーションエラー**: 早期リターンまたはスキップ

```javascript
_operation() {
  const rawData = this._loadData();

  // データが空の場合はエラー
  if (rawData.length === 0) {
    throw new Error("処理対象のデータが存在しません。");
  }

  // 個別行の不正データはスキップ
  for (const row of rawData) {
    if (!row.month) continue;  // スキップ
    // 処理
  }
}
```

### 7.2 メッセージ表現

専門用語を避け、簡潔で分かりやすい日本語を使用します。

```javascript
// ❌ 悪い例
throw new Error("NullPointerException: data is null");

// ✅ 良い例
throw new Error("処理対象のデータが存在しません。dataシートを確認してください。");
```

---

## 8. ビルドと開発フロー

### 8.1 npm スクリプト

```bash
npm run build         # vite でビルド（dist/main.js を生成）
npm run build:watch   # 変更監視 + 自動ビルド
npm run push          # clasp で GAS へプッシュ
npm run push:watch    # 変更監視 + 自動プッシュ
npm run deploy        # ビルド + プッシュ
```

### 8.2 Vite 設定の特徴（vite.config.js）

```javascript
// 1. rollup-plugin-google-apps-script
//    global.xxx = ... をGASのトップレベル関数としてエクスポートする
plugins: [rollupPluginGas(), /* appsscript.json を dist/ へコピーするカスタムプラグイン */],

// 2. エントリーポイントと出力
build: {
  rollupOptions: {
    input: "src/index.js",
    output: { dir: "dist", entryFileNames: "main.js" },
  },
  minify: false, // trueにすると関数名が消えるのでfalse必須
},

// 3. パスエイリアス（@/ → src/）
resolve: {
  alias: { "@": path.resolve(__dirname, "./src") },
},
```

#### 注意点

- **`minify: false` は変更禁止**: minify するとグローバル関数名が消え、GAS から呼び出せなくなります
- **インポートは必ず `@/` エイリアスを使用**: エイリアス外のパスは外部モジュール扱いとなり、エラーにならないままバンドルから欠落します（1.3節参照）
- ビルド後は `dist/main.js` と `dist/appsscript.json` が生成され、clasp はこの `dist/` をプッシュします（`.clasp.json` の `rootDir`）

---

## 9. 実装例テンプレート

### 9.1 新規 Operation 作成

```javascript
// src/operations/new_feature_operation.js
import { BaseOperation } from "@/base_classes/base_operation";
import { SomeSheetData } from "@/sheet_data/some_sheet_data";

/**
 * 新機能の操作を実行するクラス
 */
export class NewFeatureOperation extends BaseOperation {
  /**
   * 新機能のメイン処理を実行します
   */
  _operation() {
    // 1. データ取得
    const data = this._loadData();

    // 2. データ加工
    const processedData = this._processData(data);

    // 3. 結果出力
    this._outputResult(processedData);

    // 4. 完了通知
    SpreadsheetApp.getUi().alert("処理が完了しました。");
  }

  /**
   * データを読み込みます
   * @returns {Array<Object>}
   * @private
   */
  _loadData() {
    const data = SomeSheetData.all;
    if (data.length === 0) {
      throw new Error("処理対象のデータが存在しません。");
    }
    return data;
  }

  /**
   * データを加工します
   * @param {Array<Object>} data 入力データ
   * @returns {Array<Object>} 加工後データ
   * @private
   */
  _processData(data) {
    return data.map(row => {
      // 加工処理
      return { ...row, processed: true };
    });
  }

  /**
   * 結果を出力します
   * @param {Array<Object>} data 出力データ
   * @private
   */
  _outputResult(data) {
    // 出力処理
  }
}
```

### 9.2 新規 DAO 作成

```javascript
// src/sheet_data/new_sheet_data.js
import { BoundSheetData } from "@/base_classes/base_sheet_data";
import { BOUND_SHEETS, NAMED_RANGES } from "@/constants";

/**
 * new_sheetシートへのデータアクセスを提供するクラス
 */
export class NewSheetData extends BoundSheetData {
  /**
   * 全データを取得します（ヘッダー行はスキップ）
   * @returns {Array<Object>} オブジェクトの配列
   */
  static get all() {
    const get = () => {
      const sheet = this._getSheet(BOUND_SHEETS.NEW_SHEET);
      if (!sheet) return [];

      const data = sheet.getDataRange().getValues().slice(1).filter(row => row[0]);
      const cols = this._getNamedRangeColsOf(sheet);

      return data.map(row => Object.freeze({
        field1: row[cols[NAMED_RANGES.BOUND_SHEETS.NEW_SHEET.FIELD1] - 1],
        field2: row[cols[NAMED_RANGES.BOUND_SHEETS.NEW_SHEET.FIELD2] - 1],
      }));
    };

    this._allCache = this._allCache || get();
    return this._allCache;
  }

  /**
   * キャッシュをクリアします
   */
  static clearCache() {
    this._allCache = null;
  }
}
```

### 9.3 新規 Utility 作成

```javascript
// src/utils/new_utils.js

/**
 * 新しいユーティリティ機能を提供するクラス
 */
export class NewUtils {
  /**
   * 値を正規化します
   * @param {string|number} value 正規化対象の値
   * @returns {string} 正規化された値
   * @throws {Error} 値が無効な場合
   */
  static normalize(value) {
    if (value === null || value === undefined) {
      throw new Error("value は必須です。");
    }

    if (typeof value === 'string') {
      return value.trim().toLowerCase();
    }

    return String(value);
  }

  /**
   * 配列をグループ化します
   * @param {Array<Object>} array グループ化対象の配列
   * @param {string} key グループ化キー
   * @returns {Map<string, Array<Object>>} グループ化されたMap
   */
  static groupBy(array, key) {
    return array.reduce((map, item) => {
      const groupKey = item[key];
      if (!map.has(groupKey)) {
        map.set(groupKey, []);
      }
      map.get(groupKey).push(item);
      return map;
    }, new Map());
  }
}
```

---

## 10. チェックリスト

新しいコードを書く前に確認してください：

### 実装前
- [ ] `specs/` に仕様書を作成したか
- [ ] 関連する既存の Operation / DAO / Utils を調査したか
- [ ] 再利用可能な既存コードはないか

### 実装中
- [ ] 適切な基底クラスを継承しているか
- [ ] インポートに `@/` エイリアスを使用しているか
- [ ] 命名規則に従っているか
- [ ] JSDocコメントを記述したか
- [ ] 定数は `constants.js` に定義したか
- [ ] キャッシュパターンを使用しているか

### 実装後
- [ ] `npm run build` でエラーがないか
- [ ] `dist/main.js` に `require(...)` や UMD ラッパーが混入していないか（インポートパス誤りの兆候）
- [ ] インポート文の順序は正しいか
- [ ] 不要なコンソールログを削除したか
