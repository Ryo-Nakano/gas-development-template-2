import { SheetUtils } from "utils/sheet_utils";

/**
 * 基本的な操作を提供するクラス。継承して具体的な操作を実装します。
 */
export class BaseOperation {
  /**
   * 継承先でオーバーライドされるべき操作メソッド。派生クラスで具体的な処理を実装する必要があります。
   * @throws {Error} このメソッドは派生クラスでオーバーライドする必要があります。
   */
  _operation() {
    throw new Error('You must override this method in the derived class');
  }

  /**
   * 操作を実行するメソッド。インスタンスから呼び出され、操作中にエラーが発生した場合はキャッチして再スローします。
   * @return {*} _operationメソッドの戻り値を返します。
   * @throws {Error} 操作中に発生したエラーを再スローします。
   */
  run() {
    try {
      return this._operation();
    } catch (error) {
      // エラーキャッチ時にする処理
      throw error;
    }
  }

  /**
   * スプレッドシートオブジェクトを取得します。キャッシュが存在しない場合はアクティブなスプレッドシートを取得します。
   * @return {GoogleAppsScript.Spreadsheet.Spreadsheet} アクティブなスプレッドシートオブジェクト
   */
  _getSpreadsheet() {
    this._spreadsheetCache = this._spreadsheetCache || SpreadsheetApp.getActiveSpreadsheet();
    return this._spreadsheetCache;
  }

  /**
   * 指定したシート名のシートオブジェクトを取得します。キャッシュが存在しない場合は新しく取得し、キャッシュに保存します。
   * @param {string} sheetName シート名
   * @return {GoogleAppsScript.Spreadsheet.Sheet|null} 指定した名前のシートオブジェクト。存在しない場合は null を返します。
   */
  _getSheet(sheetName) {
    this._sheetCache = this._sheetCache || {};
    this._sheetCache[sheetName] = this._sheetCache[sheetName] || this._getSpreadsheet().getSheetByName(sheetName);
    return this._sheetCache[sheetName];
  }

  /**
   * 指定したシートの名前付き範囲の列番号を取得します。キャッシュが存在しない場合は新しく取得し、キャッシュに保存します。
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet 対象のシート
   * @return {Object} シートIDと名前付き範囲の列番号を格納したオブジェクト
   */
  _getNamedRangeColsOf(sheet) {
    const sheetId = sheet.getSheetId();
    this._namedRangeColsCache = this._namedRangeColsCache || {};
    this._namedRangeColsCache[sheetId] = this._namedRangeColsCache[sheetId] || SheetUtils.getNamedRangeColsOf(sheet);
    return this._namedRangeColsCache[sheetId];
  }

  /**
   * 指定したシートの名前付き範囲オブジェクトを取得します。キャッシュが存在しない場合は新しく取得し、キャッシュに保存します。
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet 対象のシート
   * @return {Object} シートIDと名前付き範囲オブジェクトを格納したオブジェクト
   */
  _getNamedRangesOf(sheet) {
    const sheetId = sheet.getSheetId();
    this._namedRangesCache = this._namedRangesCache || {};
    this._namedRangesCache[sheetId] = this._namedRangesCache[sheetId] || SheetUtils.getNamedRangesOf(sheet);
    return this._namedRangesCache[sheetId];
  }

  /**
   * 指定した日付から現在までの経過時間を分単位で計算します。
   * @param {Date} date 基準となる日付
   * @return {number} 経過時間（分）
   */
  _elapsedMinutesFrom(date) {
    return ((new Date()).getTime() - date.getTime()) / 1000 / 60;
  }

  /**
   * 処理の進捗をパーセンテージでコンソールに出力します。
   * @param {number} index 現在の処理のインデックス
   * @param {number} length 全体の処理数
   */
  _printProgress(index, length) {
    const progress = Math.floor((((index + 1)/length)*100)*10) / 10;
    console.log(` - progress : ${progress}% (${index + 1}/${length})`);
  }

  /**
   * 指定した関数名で時間ベースの新しいトリガーを設定します。
   * @param {string} functionName トリガーする関数名
   * @param {number} minutes トリガーを設定するまでの時間（分）
   */
  _setNewTrigger(functionName, minutes) {
    const dt = new Date();
    dt.setMinutes(dt.getMinutes() + minutes);
    ScriptApp.newTrigger(functionName).timeBased().at(dt).create();
  }
}
