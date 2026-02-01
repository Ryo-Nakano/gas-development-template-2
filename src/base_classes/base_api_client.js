/**
 * HTTPメソッド定数
 */
export const METHODS = {
  POST: 'post',
  GET: 'get',
  PUT: 'put',
  PATCH: 'patch',
  DELETE: 'delete',
};

/**
 * 外部API呼び出しの基底クラス
 */
export class BaseApiClient {
  /**
   * ベースURLを返す。派生クラスでオーバーライド必須。
   * @returns {string}
   */
  get _BASE_URL() {
    throw new Error('You must override _BASE_URL in the derived class');
  }

  /**
   * ベースヘッダーを返す。派生クラスでオーバーライド必須。
   * @returns {Object}
   */
  get _BASE_HEADERS() {
    throw new Error('You must override _BASE_HEADERS in the derived class');
  }

  constructor() { }

  /**
   * エンドポイント定義を受け取りリクエストを実行する
   * @param {Object} endpoint - エンドポイント定義
   * @param {string} endpoint.method - HTTPメソッド
   * @param {string} endpoint.path - パス
   * @param {Object} [endpoint.headers] - 追加ヘッダー
   * @param {Object} [endpoint.params] - クエリパラメータ
   * @param {Object} [endpoint.payload] - リクエストボディ
   * @returns {Object} レスポンス { status, data }
   */
  request(endpoint) {
    const isValidMethod = Object.values(METHODS).includes(endpoint.method);
    if (!isValidMethod || !endpoint.path) {
      throw new Error('invalid request');
    }
    return this._methods[endpoint.method]({
      path: endpoint.path,
      headers: endpoint.headers || {},
      params: endpoint.params || {},
      payload: endpoint.payload || {},
    });
  }

  /**
   * HTTPメソッドと対応する内部メソッドのマッピング
   * @returns {Object}
   * @private
   */
  get _methods() {
    return {
      [METHODS.POST]: this._post.bind(this),
      [METHODS.GET]: this._get.bind(this),
      [METHODS.PUT]: this._put.bind(this),
      [METHODS.PATCH]: this._patch.bind(this),
      [METHODS.DELETE]: this._delete.bind(this),
    };
  }

  /**
   * POSTリクエストを実行する
   * @param {Object} params
   * @param {string} params.path - パス
   * @param {Object} [params.headers] - 追加ヘッダー
   * @param {Object} [params.payload] - リクエストボディ
   * @returns {Object}
   * @private
   */
  _post({ path, headers = {}, payload = {} }) {
    const url = this._buildUrl(path);
    const res = UrlFetchApp.fetch(url, {
      method: METHODS.POST,
      headers: { ...this._BASE_HEADERS, ...headers },
      contentType: 'application/json',
      payload: JSON.stringify(payload),
    });
    return this._serialize(res);
  }

  /**
   * GETリクエストを実行する
   * @param {Object} params
   * @param {string} params.path - パス
   * @param {Object} [params.headers] - 追加ヘッダー
   * @param {Object} [params.params] - クエリパラメータ
   * @returns {Object}
   * @private
   */
  _get({ path, headers = {}, params = {} }) {
    let url = this._buildUrl(path);
    const queryString = this._buildQueryString(params);
    if (queryString) {
      url = `${url}?${queryString}`;
    }
    const res = UrlFetchApp.fetch(url, {
      method: METHODS.GET,
      headers: { ...this._BASE_HEADERS, ...headers },
    });
    return this._serialize(res);
  }

  /**
   * PUTリクエストを実行する
   * @param {Object} params
   * @private
   */
  _put({ path, headers = {}, payload = {} }) {
    const url = this._buildUrl(path);
    const res = UrlFetchApp.fetch(url, {
      method: METHODS.PUT,
      headers: { ...this._BASE_HEADERS, ...headers },
      contentType: 'application/json',
      payload: JSON.stringify(payload),
    });
    return this._serialize(res);
  }

  /**
   * PATCHリクエストを実行する
   * @param {Object} params
   * @private
   */
  _patch({ path, headers = {}, payload = {} }) {
    const url = this._buildUrl(path);
    const res = UrlFetchApp.fetch(url, {
      method: METHODS.PATCH,
      headers: { ...this._BASE_HEADERS, ...headers },
      contentType: 'application/json',
      payload: JSON.stringify(payload),
    });
    return this._serialize(res);
  }

  /**
   * DELETEリクエストを実行する
   * @param {Object} params
   * @private
   */
  _delete({ path, headers = {}, payload = {} }) {
    const url = this._buildUrl(path);
    const res = UrlFetchApp.fetch(url, {
      method: METHODS.DELETE,
      headers: { ...this._BASE_HEADERS, ...headers },
      contentType: 'application/json',
      payload: JSON.stringify(payload),
    });
    return this._serialize(res);
  }

  /**
   * ベースURLとパスを結合してURLを生成する
   * @param {string} path - パス
   * @returns {string}
   * @private
   */
  _buildUrl(path) {
    return `${this._BASE_URL}${path}`;
  }

  /**
   * クエリパラメータを文字列に変換する
   * @param {Object} params - クエリパラメータ
   * @returns {string}
   * @private
   */
  _buildQueryString(params) {
    return Object.entries(params)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
  }

  /**
   * レスポンスをオブジェクトに変換する
   * @param {GoogleAppsScript.URL_Fetch.HTTPResponse} res - レスポンス
   * @returns {Object} { status, data }
   * @private
   */
  _serialize(res) {
    if (!res) return null;
    const status = res.getResponseCode();
    const data = JSON.parse(res.getContentText('utf-8'));
    return { status, data };
  }
}
