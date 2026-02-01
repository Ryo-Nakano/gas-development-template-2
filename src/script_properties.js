class ScriptProperties {

  static get _scriptProperties() {
    this._cache = this._cache || PropertiesService.getScriptProperties().getProperties();
    return this._cache;
  }

  // getters ...
  static get(key) {
    return this._scriptProperties[key] || null;
  }

  // 利用イメージ
  // ScriptProperties.get(SCRIPT_PROPERTIES.SSID)
}
