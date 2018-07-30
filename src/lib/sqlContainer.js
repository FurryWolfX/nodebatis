const Rule = require('./rule')
const path = require('path')
const vm = require('vm')
const fs = require('fs')

const keyReg = /\:([\w\._]+)/g
const ddlKeyReg = /\::([\w\._]+)/g
const childKeyReg = /\{{\s*([\w\._]+)\s*}}/g

class SqlContainer {
    constructor(dir) {
        this.container = new Map()
        let files = fs.readdirSync(dir), rule = null
        for (var file of files) {
            if(file.indexOf('.swp') == -1) {
                rule = new Rule(path.join(dir, file))
                this.container.set(rule.namespace, rule.rawSql)
            }
        }
    }

    get(key, data) {
        let sqlArray = this.getRaw(key)
        return this._parseRawSql(sqlArray, data)
    }

    getRaw(key) {
        let keys = key.split('.'), sql = null
        if (keys.length < 2) {
            console.error('wrong key, the right key is xxx.xxx')
            return
        }
        let namespace = keys[0]
        let sqlKey = keys.slice(1).join('')
        let sqlMap = this.container.get(namespace)
        if (sqlMap) {
            sql = sqlMap.get(sqlKey)
            if (!sql) {
                console.error('The sql:', key, 'not exists!')
            }
        } else {
            console.error('The namespace:', namespace, 'not exists!')
        }
        return sql
    }

    _parseRawSql(sqlArray, data) {
        let sqls = [], result = '', condSql = ''
        let rawSql = [], params = []
        for (let sql of sqlArray) {
            if (typeof sql == 'string') {
                sqls.push(this._fillParams(sql, data))
            } else {
                condSql = this._parseCond(sql, data)
                if (condSql) {
                    sqls.push(condSql)
                }
            }
        }
        //combine sql and params
        for (let item of sqls) {
            rawSql.push(item.sql)
            if (item.params) {
                params = params.concat(item.params)
            }
        }
        result = rawSql.join(' ')
        let lastWhereReg = /\s+where$/i
        let whereAndReg = /\s+where\s+and\s+/ig
        let whereOtherReg = /\s+where\s+(union\s+|order\s+|group\s+|limit\s+)/gi
        result = result.replace(lastWhereReg, '')
        result = result.replace(whereAndReg, ' where ')
        result = result.replace(whereOtherReg, (match) => {
            return match.replace(/\s+where\s+/i, ' ')
        })
        return {
            sql: result,
            params
        }
    }

    _parseCond(node, data) {
        let sql = null, statements = ''
        data = data || {}
        const context = new vm.createContext(data)
        if (node.name.toLowerCase() === 'if') {
            if (node.test && typeof node.test == 'string') {
                statements = node.test.replace(keyReg, (match, key) => {
                    data[key] = data[key] || null
                    return key
                })
                let isTrue = false
                try {
                    isTrue = new vm.Script(statements).runInContext(context)
                } catch (e) {
                    isTrue = false
                }
                if (isTrue) {
                    sql = this._fillParams(node.sql, data)
                }
            }
        }
        if (node.name.toLowerCase() === 'for') {
            if (node.array) {
                let sqlArray = [], rawSql = [], params = []
                if (node.array) {
                    for (let item of data[node.array]) {
                        sqlArray.push(this._fillParams(node.sql, item))
                    }
                }
                for (let item of sqlArray) {
                    rawSql.push(item.sql)
                    params = params.concat(item.params)
                }
                sql = {
                    sql: rawSql.join(node.seperator),
                    params
                }
            }
        }
        return sql
    }

    _fillParams(sql, data) {
        let params = [], that = this
        //fill ::key
        sql = sql.replace(ddlKeyReg, (match, key) => {
            return data[key]
        })
        //fill :key
        sql = sql.replace(keyReg, (match, key) => {
            params.push(data[key])
            return '?'
        })
        //fill {{key}}
        sql = sql.replace(childKeyReg, (match, key) => {
            return that.get(key).sql
        })
        return {
            sql: sql,
            params: params.length > 0 ? params : null
        }
    }
}

module.exports = SqlContainer

