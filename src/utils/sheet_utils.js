/**
 * シートの名前付き範囲の列番号を取得するユーティリティクラス
 */
export class SheetUtils {

  /**
   * 指定したシートの全ての名前付き範囲の列番号をオブジェクト形式で取得します。
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet 対象のシート
   * @return {Object|null} 名前付き範囲の名前と列番号のペアを持つオブジェクト。名前付き範囲が存在しない場合は null を返します。
   */
  static getNamedRangeColsOf(sheet) {
    if(!sheet) return null;

    const namedRanges = sheet.getNamedRanges();
    if(!namedRanges.length) return null;

    // {name: rangeCol} 形式のオブジェクトにして返す
    return namedRanges.reduce((acc, namedRange) => {
      const name = namedRange.getName();
      const rangeCol = namedRange.getRange().getColumn();
      acc[name] = rangeCol;
      return acc;
    }, {});
  }

  /**
   * 指定したシートの全ての名前付き範囲をオブジェクト形式で取得します。
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet 対象のシート
   * @return {Object|null} 名前付き範囲の名前と範囲オブジェクトのペアを持つオブジェクト。名前付き範囲が存在しない場合は null を返します。
   */
  static getNamedRangesOf(sheet) {
    if(!sheet) return null;

    const namedRanges = sheet.getNamedRanges();
    if(!namedRanges.length) return null;

    // {name: range} 形式のオブジェクトにして返す
    return namedRanges.reduce((acc, namedRange) => {
      const name = namedRange.getName();
      const range = namedRange.getRange();
      acc[name] = range;
      return acc;
    }, {});
  }

  /**
   * 指定したシートの最後の行にデータを追加します。
   * @param {Object} params パラメータオブジェクト
   * @param {GoogleAppsScript.Spreadsheet.Sheet} params.sheet データを追加するシート
   * @param {Array<Array<any>>} params.data 追加するデータの2次元配列
   * @throws {Error} データ追加に失敗した場合はエラーをスローします。
   */
  static addToLastRow({sheet, data}) {
    try {
      if(!sheet || !data || !data.length) return;

      const lastRow = sheet.getLastRow();
      const fromRow = lastRow + 1;
      const fromCol = 1;
      const rows = data.length;
      const cols = data[0].length;
      const range = sheet.getRange(fromRow, fromCol, rows, cols);

      range.setValues(data);
    }
    catch(error) {
      console.error(error);
      throw Error('faild to add data to last row ...');
    }
  }

  /**
   * 指定された行以降のシートの内容をクリアします。
   *
   * @param {Object} params - パラメータオブジェクト
   * @param {GoogleAppsScript.Spreadsheet.Sheet} params.sheet - 対象となるGoogleシートオブジェクト
   * @param {number} params.fromRow - この行以降の内容を削除します（1から始まる行番号）
   * @throws {Error} シートが有効でない場合、またはfromRowが有効な行番号でない場合にエラーを投げます。
   * @returns {void} 
   */
  static clearSheetContent({sheet, fromRow}) {
    if (!sheet || typeof sheet.getRange !== 'function') throw new Error('有効なシートオブジェクトを渡してください');
    if (!Number.isInteger(fromRow) || fromRow <= 0) throw new Error('有効な行番号 (fromRow) を渡してください');
  
    const lastRow = sheet.getLastRow();
    if (fromRow > lastRow) return; // fromRow が最終行を超えている場合は処理を終了
    const range = sheet.getRange(fromRow, 1, lastRow - fromRow + 1, sheet.getLastColumn());
    range.clearContent();
  }
}
