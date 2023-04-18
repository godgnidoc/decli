import { ArgPass, CliArg, CliOption, parseOptionArg } from "./argument"
import { cli, comp } from "./common"

export interface Option {
    /** 属性所属的目标对象 */
    target: any

    /** 选项指向的属性名 */
    property: string

    /** 短选项，格式固定为 /^-[a-zA-Z0-1]$/ */
    short?: string

    /** 长选项 */
    long?: string

    /** 选项简介 */
    brief?: string

    /** 是否必须 */
    required?: boolean

    /** 是否可重复，可重复的属性被定义为原类型的数组 */
    repeat?: boolean

    /** 
     * 选项参数
     * 若为字符串数组，则表示仅接受一个参数，且参数必须为数组中的某个字符串
     * 若为函数，则表示自定义参数检查，函数返回值为 boolean 则表示参数合法，否则返回错误信息
     *  自定义参数检查函数返回 true 表示接受当前参数，继续检查下一个参数
     *  自定义参数检查函数返回 false 表示不接受当前参数，且不再检查后续参数
     *  自定义参数检查函数的第一个参数为已接受的参数，第二个参数为当前接收到的参数
     *  命令行参数耗尽后，自定义参数检查函数的第二个参数为 undefined
     *  自定义参数检查函数返回Error不会导致参数接纳被停止，而是报错后继续分析参数
     */
    args?: string[] | ArgPass

    /** 
     * 参数自动补全 
     * @param editing 是否正在编辑最后一个参数
     * @param args 已经输入的参数
     * @return 若返回 undefined 则表示不支持自动补全
     */
    complete?: ((editing: boolean, args: string[]) => string[])
}

export function GetOptionDescTable(target: any, create = false): undefined | { [key: string]: Option } {
    if (!(target instanceof Object)) return undefined
    if (create && !target["__options__"]) target["__options__"] = {}
    return target["__options__"]
}

export function GetOptionDesc(target: any, propertyKey: string): Option {
    const table = GetOptionDescTable(target, true)
    if (!table[propertyKey])
        table[propertyKey] = {
            property: propertyKey,
            target: target
        }
    return table[propertyKey]
}

function matchOption(defines: { [key: string]: Option }, arg: CliArg): CliOption {
    if (typeof arg !== 'string') return undefined
    let define = undefined
    if (/^--[a-zA-Z0-9-]+$/.test(arg)) {
        for (const property in defines)
            if (defines[property].long === arg) define = defines[property]
    } else if (/^-[a-zA-Z0-9]$/.test(arg)) {
        for (const property in defines)
            if (defines[property].short === arg) define = defines[property]
    }
    if (define) return {
        is: 'option',
        define: define,
        value: undefined,
        keyword: arg
    }
    return undefined
}

export function unfoldShortOptions(args: string[]) {
    for (let i = 0; i < args.length; i++) {
        const arg0 = args[i]
        if (cli.app.options_end && arg0 === cli.app.options_end) return
        if (!/^-[a-zA-Z0-9][a-zA-Z0-9]+$/.test(arg0)) continue
        const shorts = arg0.slice(1).split('').map(c => `-${c}`)
        args.splice(i, 1, ...shorts)
    }
}

export function parseOptions(target: any, defines: { [key: string]: Option }, args: CliArg[]): boolean {
    let correct = true
    const pending = new Set<string>(Object.keys(defines).filter(key => defines[key].required))
    const seen = new Set<string>()

    for (let i = 0; i < args.length;) {
        /** 跳过选项结束符 */
        if (cli.app.options_end && args[i] === cli.app.options_end) break

        /** 尝试匹配选项，若未匹配到选项则跳过当前命令行参数 */
        const option = matchOption(defines, args[i])
        if (!option) { i++; continue }

        /** 成功匹配选项则消费一个命令行参数 */
        args.splice(i++, 1, option)
        pending.delete(option.define.property)

        if (!parseOptionArg(option, args, i)) {
            correct = false
            continue
        }

        /** 为选项设置值 */
        if (option.define.repeat) {
            if (target[option.define.property] instanceof Array) {
                target[option.define.property].push(... (
                    option.value instanceof Array
                        ? option.value
                        : [option.value]
                ))
            } else {
                target[option.define.property] = option.value instanceof Array
                    ? option.value
                    : [option.value]
            }
        } else {
            if (seen.has(option.define.property))
                console.warn(`Option ${option.keyword} is already set, the new value will overwrite the old one`)
            seen.add(option.define.property)
            target[option.define.property] = option.value
        }
    }

    /** 尽可能提示更多选项 */
    if (comp.completeing) {
        for (const option of Object.values(defines)) {
            if (option.repeat || !seen.has(option.property)) {
                comp.response.push(
                    ...[option.long, option.short].filter(v => v)
                )
            }
        }
    }

    /** 检查是否有必选选项未设置 */
    for (const option of pending) {
        console.error(`Option ${option} is required`)
        correct = false
    }

    return correct
}

function verifyOptionShortName(option: Option, local_names: Set<string>) {
    if (option.short) {
        /** 短选项格式检查 */
        if (!/^-[a-zA-Z0-9]$/.test(option.short)) {
            console.error(`[ERROR] Invalid option short name: ${option.short}`)
            return false
        }

        /** 符号冲突检查 */
        if (local_names.has(option.short)) {
            console.error(`[ERROR] Duplicate option short name: ${option.short}`)
            return false
        }

        local_names.add(option.short)
    }
    return true
}

function verifyOptionLongName(option: Option, local_names: Set<string>) {
    if (option.long) {
        /** 长选项格式检查 */
        if (!/^--[a-zA-Z0-9-]+$/.test(option.long)) {
            console.error(`[ERROR] Invalid option long name: ${option.long}`)
            return false
        }

        /** 符号冲突检查 */
        if (local_names.has(option.long)) {
            console.error(`[ERROR] Duplicate option long name: ${option.long}`)
            return false
        }

        local_names.add(option.long)
    }
    return true
}

export function verifyOptionDefinitions(options: { [key: string]: Option }, local_names: Set<string>) {
    let correct = true

    for (const key in options) {
        const option = options[key]
        if (typeof option !== 'object') {
            correct = (console.error(`[ERROR] Invalid option definition: ${key}`), false)
            continue
        }

        if (!verifyOptionShortName(option, local_names)) {
            correct = false
            continue
        }

        if (!verifyOptionLongName(option, local_names)) {
            correct = false
            continue
        }

        /** 短选项和长选项至少有一个 */
        if (!option.short && !option.long) {
            correct = (console.error(`[ERROR] Option must have a short or long name: ${key}`), false)
            continue
        }

        /** 重复性检查 */
        if (option.repeat && !option.args) {
            correct = (console.error(`[ERROR] Repeatable option must have arguments: ${key}`), false)
            continue
        }
    }
    return correct
}