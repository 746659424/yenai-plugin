import plugin from '../../../lib/plugins/plugin.js'
import { segment } from 'oicq'
import cfg from '../../../lib/config/config.js'
import common from '../../../lib/common/common.js'
import fs from 'fs'

class Config {

    /** 读取文件 */
    async getread(path) {
        return await fs.promises
            .readFile(path, 'utf8')
            .then((data) => {
                return JSON.parse(data)
            })
            .catch((err) => {
                logger.error('读取失败')
                console.error(err)
                return false
            })
    }

    /** 写入json文件 */
    async getwrite(path, cot = {}) {
        return await fs.promises
            .writeFile(path, JSON.stringify(cot, '', '\t'))
            .then(() => {
                return true
            })
            .catch((err) => {
                logger.error('写入失败')
                console.error(err)
                return false
            })
    }

    /** 发消息 */
    async getSend(msg) {
        if (await redis.del(`yenai:notice:notificationsAll`,)) {
            // 发送全部管理
            for (let index of cfg.masterQQ) {
                await common.relpyPrivate(index, msg)
            }
        } else {
            // 发给第一个管理
            await common.relpyPrivate(cfg.masterQQ[0], msg)
            await common.sleep(200)
        }
    }

    /**
     * @description: 秒转换
     * @param {Number} time  秒数
     * @param {boolean} repair  是否需要补零
     * @return {object} 包含天，时，分，秒
     */
    getsecond(time, repair) {
        let second = parseInt(time)
        let minute = 0
        let hour = 0
        let day = 0
        if (second > 60) {
            minute = parseInt(second / 60)
            second = parseInt(second % 60)
        }
        if (minute > 60) {
            hour = parseInt(minute / 60)
            minute = parseInt(minute % 60)
        }
        if (hour > 23) {
            day = parseInt(hour / 24)
            hour = parseInt(hour % 24)
        }
        if (repair) {
            hour = hour < 10 ? "0" + hour : hour
            minute = minute < 10 ? "0" + minute : minute
            second = second < 10 ? "0" + second : second
        }
        return {
            day,
            hour,
            minute,
            second
        }
    }

    /**
     * @description: //发送转发消息
     * @param {*} e oicq
     * @param {Array} message 发送的消息
     * @param {Number} time  撤回时间
     * @param {Boolean} isBot 转发信息是否以bot信息发送
     * @param {Boolean} isfk 是否发送默认风控消息
     * @return {Boolean}
     */
    async getforwardMsg(e, message, time = 0, isBot = true, isfk = true) {
        let forwardMsg = []
        for (let i of message) {
            forwardMsg.push(
                {
                    message: i,
                    nickname: isBot ? Bot.nickname : e.sender.nickname,
                    user_id: isBot ? Bot.uin : e.sender.user_id
                }
            )
        }
        //发送
        if (e.isGroup) {
            forwardMsg = await e.group.makeForwardMsg(forwardMsg)
        } else {
            forwardMsg = await e.friend.makeForwardMsg(forwardMsg)
        }

        //发送消息
        let res = await e.reply(forwardMsg, false, { recallMsg: time })
        if (!res) {
            if (isfk) {
                await e.reply("消息发送失败，可能被风控")
            }
            return false
        }
        return true;
    }


    /**
     * @description: 发送消息并根据指定时间撤回群消息
     * @param {*} e oicq
     * @param {*} msg 消息
     * @param {Number} time 撤回时间
     * @param {Boolean} isfk 是否发送默认风控消息
     * @return {*}
     */
    async recallsendMsg(e, msg, time = 0, isfk = true) {
        time = time || await this.recalltime(e)
        
        //发送消息
        let res = await e.reply(msg, false, { recallMsg: time })
        if (!res) {
            if (isfk) {
                await e.reply("消息发送失败，可能被风控")
            }
            return false
        }
        return true;
    }

    /**
     * @description: 获取配置的cd发送消息
     * @param {*} e oicq
     * @param {Array} msg 发送的消息
     * @param {Boolean} isBot 转发信息是否以bot信息发送
     * @param {Boolean} isfk  是否发送默认风控消息
     * @return {Boolean}
     */
    async getCDsendMsg(e, msg, isBot = true, isfk = true) {
        let time = await this.recalltime(e)

        let res = await this.getforwardMsg(e, msg, time, isBot, isfk)

        if (!res) return false;

        return true;
    }

    /**
     * @description: 获取群的撤回时间
     * @param {*} e oicq
     * @return {Number} 
     */
    async recalltime(e) {
        if (!e.isGroup) return 0;
        let path = "./plugins/yenai-plugin/config/setu/setu.json"
        //获取撤回时间
        let cfgs = {};
        let time = 120;
        if (fs.existsSync(path)) {
            cfgs = await this.getread(path)
        }

        if (cfgs[e.group_id]) {
            time = cfgs[e.group_id].recall
        }
        return time
    }

    /**
     * @description: 取cookie
     * @param {String} data 如：qun.qq.com
     * @return {Object} 
     */
    getck(data) {
        let cookie = Bot.cookies[data]
        let ck = cookie.replace(/=/g, `":"`).replace(/;/g, `","`).replace(/ /g, "").trim()
        ck = ck.substring(0, ck.length - 2)
        ck = `{"`.concat(ck).concat("}")
        return JSON.parse(ck)
    }
}


export default new Config();