import YAML from "yaml"
import chokidar from "chokidar"
import fs from "node:fs"
import YamlReader from "./YamlReader.js"
import cfg from "../../../lib/config/config.js"
import _ from "lodash"

const Path = process.cwd()
const Plugin_Name = "yenai-plugin"
const Plugin_Path = `${Path}/plugins/${Plugin_Name}`
class Config {
  constructor() {
    this.config = {}

    /** 监听文件 */
    this.watcher = { config: {}, defSet: {} }

    this.initCfg()
  }

  /** 初始化配置 */
  initCfg() {
    let path = `${Plugin_Path}/config/config/`
    let pathDef = `${Plugin_Path}/config/default_config/`
    const files = fs.readdirSync(pathDef).filter(file => file.endsWith(".yaml"))
    for (let file of files) {
      if (!fs.existsSync(`${path}${file}`)) {
        fs.copyFileSync(`${pathDef}${file}`, `${path}${file}`)
      } else {
        this.mergeCfg(`${path}${file}`, `${pathDef}${file}`, file)
      }
      this.watch(`${path}${file}`, file.replace(".yaml", ""), "config")
    }
  }

  async mergeCfg(cfgPath, defPath, name) {
    if (await redis.get(`yenai-plugin:mergeCfg:${name}`)) return
    const doc1 = YAML.parseDocument(fs.readFileSync(cfgPath, "utf8"))
    const doc2 = YAML.parseDocument(fs.readFileSync(defPath, "utf8"))
    const existingKeys = new Map()
    for (const item of doc1.contents.items) {
      existingKeys.set(item.key.value, item)
    }

    for (const item of doc2.contents.items) {
      if (!existingKeys.has(item.key.value)) {
        doc1.contents.items.push(item)
      }
    }
    let yaml = doc1.toString()
    fs.writeFileSync(cfgPath, yaml, "utf8")
    // 每天只合并一次避免影响效率
    redis.set(`yenai-plugin:mergeCfg:${name}`, "1", { EX: 60 * 60 * 24 })
  }

  getNotice(botId = "", groupId = "") {
    const config = this.getDefOrConfig("notice")
    const bot = `bot:${botId}`
    const botGroup = `bot:${botId}:${groupId}`
    return { ...config.default, ...config[groupId], ...config[bot], ...config[botGroup] }
  }

  /** 主人QQ */
  get masterQQ() {
    return cfg.masterQQ
  }

  get master() {
    return cfg.master
  }

  /** 获取其他设置 */
  get other() {
    return this.getDefOrConfig("other")
  }

  /** 代理 */
  get proxy() {
    return this.getDefOrConfig("proxy")
  }

  /** pixiv */
  get pixiv() {
    return this.getDefOrConfig("pixiv")
  }

  /** 哔咔 */
  get bika() {
    return this.getDefOrConfig("bika")
  }

  /** 搜图 */
  get picSearch() {
    return this.getDefOrConfig("picSearch")
  }

  /** setu */
  get setu() {
    return this.getDefOrConfig("setu")
  }

  /** 状态 */
  get state() {
    return this.getDefOrConfig("state")
  }

  /** 群管 */
  get groupAdmin() {
    return this.getDefOrConfig("groupAdmin")
  }

  /**
   * 默认配置和用户配置
   * @param name
   */
  getDefOrConfig(name) {
    let def = this.getdefSet(name)
    let config = this.getConfig(name)
    return _.merge(def, config)
  }

  /**
   * 默认配置
   * @param name
   */
  getdefSet(name) {
    return this.getYaml("default_config", name)
  }

  /**
   * 用户配置
   * @param name
   */
  getConfig(name) {
    return this.getYaml("config", name)
  }

  /**
   * 获取配置yaml
   * @param type 默认跑配置-defSet，用户配置-config
   * @param name 名称
   */
  getYaml(type, name) {
    let file = `${Plugin_Path}/config/${type}/${name}.yaml`
    let key = `${type}.${name}`

    if (this.config[key]) return this.config[key]

    this.config[key] = YAML.parse(
      fs.readFileSync(file, "utf8")
    )

    this.watch(file, name, type)

    return this.config[key]
  }

  /**
   * 监听配置文件
   * @param file
   * @param name
   * @param type
   */
  watch(file, name, type = "default_config") {
    let key = `${type}.${name}`

    if (this.watcher[key]) return

    // eslint-disable-next-line import/no-named-as-default-member
    const watcher = chokidar.watch(file)
    watcher.on("change", path => {
      delete this.config[key]
      if (typeof Bot == "undefined") return
      logger.mark(`[Yenai-Plugin][修改配置文件][${type}][${name}]`)
      if (this[`change_${name}`]) {
        this[`change_${name}`]()
      }
    })

    this.watcher[key] = watcher
  }

  /**
   * 群单独设置
   * @param {string | number} groupId 群号
   * @param {string} key 设置项
   * @param {unknown} value 修改的value值
   * @param isDel 是否删除
   */
  groupModify(groupId, key, value, isDel) {
    let path = `${Plugin_Path}/config/config/group.yaml`
    let yaml = new YamlReader(path)
    let groupCfg = yaml.jsonData[groupId] ?? {}
    isDel ? delete groupCfg[key] : groupCfg[key] = value
    yaml.set(groupId, groupCfg)
    delete this.config["config.group"]
  }

  /**
   * Bot单独设置
   * @param {string | number} botId 机器人账号
   * @param {string} key 设置项
   * @param {unknown} value 修改的value值
   * @param isDel 是否删除
   */
  botModify(botId, key, value, isDel) {
    let path = `${Plugin_Path}/config/config/bot.yaml`
    let yaml = new YamlReader(path)
    let botCfg = yaml.jsonData[botId] ?? {}
    isDel ? delete botCfg[key] : botCfg[key] = value
    yaml.set(botId, botCfg)
    delete this.config["config.bot"]
  }

  /**
   * 修改设置
   * @param {string} name 文件名
   * @param {string} key 修改的key值
   * @param {string | number} value 修改的value值
   * @param {'config'|'default_config'} type 配置文件或默认
   * @param {boolean} bot 是否修改Bot的配置
   * @param comment
   */
  modify(name, key, value, type = "config", bot = false, comment = null) {
    let path = `${bot ? Path : Plugin_Path}/config/${type}/${name}.yaml`
    new YamlReader(path).set(key, value, comment)
    delete this.config[`${type}.${name}`]
    return true
  }

  /**
   * 修改配置数组
   * @param {string} name 文件名
   * @param {string | number} key key值
   * @param {string | number} value value
   * @param {'add'|'del'} category 类别 add or del
   * @param {'config'|'default_config'} type 配置文件或默认
   * @param {boolean} bot  是否修改Bot的配置
   */
  modifyarr(name, key, value, category = "add", type = "config", bot = false) {
    let path = `${bot ? Path : Plugin_Path}/config/${type}/${name}.yaml`
    let yaml = new YamlReader(path)
    if (category == "add") {
      yaml.addIn(key, value)
    } else {
      let index = yaml.jsonData[key].indexOf(value)
      yaml.delete(`${key}.${index}`)
    }
  }

  async change_pixiv() {
    let pixiv = (await import("../model/index.js")).Pixiv
    let PixivApi = (await import("../model/Pixiv/api.js")).default
    pixiv.PixivClient = new PixivApi(this.pixiv.refresh_token)
  }
}
export default new Config()
