# JavaScript & Vite を使った GoogleAppsScript 開発テンプレート

これは JavaScript と Vite を使用した GoogleAppsScript (GAS) 開発のための最小構成テンプレートです。

## 📚 特徴
- JavaScript (ES Modules) での開発
- Vite を使用したバンドル (npm モジュールが利用可能)
- ローカルでの開発と Clasp を使用したデプロイ

## 🏃‍♂️ 始め方

#### 1. [Use this template] ボタンをクリック
<img width="473" alt="matcher-inc_gas-template-sample__TypeScript___Webpack___Clasp_で_GAS_の開発を始められるテンプレート作ってみる試み" src="https://user-images.githubusercontent.com/78125846/192661673-6bc8dbc4-fd4c-4d02-ab74-c6808dbb31de.png">

#### 2. リポジトリをクローン
```bash
git clone <Your template url> my-gas-project

 or

# テンプレートとして使用しない場合
git clone git@github.com:basefood/gas-development-template-2.git my-gas-project
```

#### 3. ディレクトリを移動
```
cd my-gas-project
```

#### 4. npm 依存関係をインストール
```
npm install
```

#### 5. `.clasp.json` を作成し、スクリプトIDを貼り付け

ルートディレクトリに `.clasp.json` というファイルを作成し、以下の内容を貼り付けてください：

```json
{
  "scriptId": "<Your Script ID>",
  "rootDir": "./dist/"
}
```

#### 6. clasp を初めて使う場合は、以下のコマンドを実行して認証
 
```
npx clasp login
```

## 🛠️ 開発ガイド

### 1. 新しい Operation (機能) の作成
ビジネスロジックは「Operation」クラス内にカプセル化します。
`src/operations/` 内に新しいファイルを作成し（例: `src/operations/my_feature.js`）、`BaseOperation` を継承します。

必ず `_operation()` メソッドを実装する必要があります。

```javascript
import { BaseOperation } from '@/base_classes/base_operation';

export class MyFeatureOperation extends BaseOperation {
  _operation() {
    // ここにビジネスロジックを記述します
    console.log("My feature is running!");
    
    // ヘルパーメソッドを利用できます
    // const sheet = this._getSheet('Sheet1');
  }
}
```

### 2. `index.js` への登録
Apps Script 側（トリガーやボタン）から関数を呼び出せるようにするには、`src/index.js` に登録します。

```javascript
import { MyFeatureOperation } from '@/operations/my_feature';

// 'myFeature' という関数名で Apps Script から利用可能になります
global.myFeature = () => {
  const operation = new MyFeatureOperation();
  operation.run();
};
```

### 3. シートデータの管理 (任意)
スプレッドシートのデータを構造的に扱うには、`BoundSheetData`（アクティブなスプレッドシート用）または `BaseSheetData` を継承したクラスを作成します。

```javascript
import { BoundSheetData } from '@/base_classes/base_sheet_data';

export class UsersSheetData extends BoundSheetData {
  // 特定のシートを返すようにオーバーライド
  static get sheet() {
    return this._getSheet('Users');
  }
  
  // データを取得するメソッドの例
  static getAllUsers() {
    const sheet = this.sheet;
    return sheet.getDataRange().getValues();
  }
}
```

### 4. SheetUtils の活用
`src/utils/sheet_utils.js` には、シート操作のための便利なユーティリティが用意されています。

```javascript
import { SheetUtils } from '@/utils/sheet_utils';

// 名前付き範囲の列番号を取得
const cols = SheetUtils.getNamedRangeColsOf(sheet);

// 最終行にデータを追加
SheetUtils.addToLastRow({ sheet, data: [[1, 2, 3]] });

// 指定行以降をクリア
SheetUtils.clearSheetContent({ sheet, fromRow: 2 });
```

## 🚀 コマンド
```bash
# vite build (ビルド)
npm run build

# vite build --watch (ウォッチモードでビルド)
npm run build:watch

# clasp push (GASへアップロード)
npm run push

# clasp push --watch (ウォッチモードでアップロード)
npm run push:watch

# ビルドしてアップロード
npm run deploy
```
