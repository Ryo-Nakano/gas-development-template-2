import { SheetUtils } from "utils/sheet_utils";

/**
 * シートに関連するデータを操作する基底クラス。継承して具体的な実装を行います。
 */
class BaseSheetData {
  /**
   * 全てのデータを取得するゲッター。派生クラスでオーバーライドする必要があります。
   * @throws {Error} 派生クラスでオーバーライドされていない場合にエラーをスローします。
   */
  static get all() {
    throw new Error('You must override getter all in the derived class');
  }

  /**
   * スプレッドシートIDを取得するゲッター。派生クラスでオーバーライドする必要があります。
   * @throws {Error} 派生クラスでオーバーライドされていない場合にエラーをスローします。
   */
  static get SSID() {
    throw new Error('You must override getter SSID in the derived class');
  }

  /**
   * スプレッドシートオブジェクトを取得します。キャッシュが存在しない場合は新しく取得し、キャッシュに保存します。
   * @return {GoogleAppsScript.Spreadsheet.Spreadsheet} スプレッドシートオブジェクト
   */
  static _getSpreadsheet() {
    const get = (ssId) => {
      return SpreadsheetApp.openById(ssId);
    };
    this._spreadsheetCache = this._spreadsheetCache || get(this.SSID);
    return this._spreadsheetCache;
  }

  /**
   * 指定したシート名のシートオブジェクトを取得します。キャッシュが存在しない場合は新しく取得し、キャッシュに保存します。
   * @param {string} sheetName シート名
   * @return {GoogleAppsScript.Spreadsheet.Sheet|null} 指定した名前のシートオブジェクト。存在しない場合は null を返します。
   */
  static _getSheet(sheetName) {
    this._sheetCache = this._sheetCache || {};
    this._sheetCache[sheetName] = this._sheetCache[sheetName] || this._getSpreadsheet().getSheetByName(sheetName);
    return this._sheetCache[sheetName];
  }

  /**
   * 指定したシートの名前付き範囲の列番号を取得します。キャッシュが存在しない場合は新しく取得し、キャッシュに保存します。
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet 対象のシート
   * @return {Object} シートIDと名前付き範囲の列番号を格納したオブジェクト
   */
  static _getNamedRangeColsOf(sheet) {
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
  static _getNamedRangesOf(sheet) {
    const sheetId = sheet.getSheetId();
    this._namedRangesCache = this._namedRangesCache || {};
    this._namedRangesCache[sheetId] = this._namedRangesCache[sheetId] || SheetUtils.getNamedRangesOf(sheet);
    return this._namedRangesCache[sheetId];
  }
}

/**
 * `BaseSheetData` クラスを継承し、変換ツールのデータ操作を提供するクラス。
 */
export class BoundSheetData extends BaseSheetData {
  /**
   * バインドされたスプレッドシートIDを返します。
   * @return {string} スプレッドシートID
   */
  static get SSID() {
    this._SSID = this._SSID || SpreadsheetApp.getActiveSpreadsheet().getId();
    return this._SSID;
  }
}
