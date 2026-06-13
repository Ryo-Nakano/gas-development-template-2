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
      throw new Error(`invalid request: ${endpoint.method} ${endpoint.path}`);
    }
    return this._fetch(endpoint.method, {
      path: endpoint.path,
      headers: endpoint.headers || {},
      params: endpoint.params || {},
      payload: endpoint.payload || {},
    });
  }

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
