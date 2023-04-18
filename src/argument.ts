import { comp } from "./common"
import { GetOptionDescTable, Option } from "./option"

export type CliArg = string | CliOption | CliElePath
export type CliOption = { is: 'option', keyword: string, define: Option, value: boolean | string | string[] }
export type CliElePath = { is: 'path', path: string[] }
export type ArgPass = (args: string[], incoming: string | undefined) => Error | boolean

function parseOptionArgCaseCanddiate(option: CliOption, args: CliArg[], start: number) {
    if (!(option.define.args instanceof Array<string>)) return false

    /** 仅接受一个参数，且参数有确定的取值范围 */
    const arg = args[start]

    /** 尝试给出补全推荐 */
    if (comp.completeing && !arg) {
        if (comp.editing) {
            /** 若最后一个单词正在编辑，则推荐可能的选项 */
            const defines = GetOptionDescTable(option.define.target)
            const keywords = [
                ...Object.values(defines).map(define => define.long),
                ...Object.values(defines).map(define => define.short)
            ].filter(keyword => keyword)
                .filter(keyword => keyword.startsWith(option.keyword))
            comp.response.push(...keywords)
        } else {
            /** 若最后一个单词已经编辑完成，则推荐可能的参数 */
            comp.completeing = false
            comp.response = [...option.define.args]
        }
    }

    /** 若参数耗尽或被其它内容占用则分析失败 */
    if (typeof arg !== 'string') {
        console.error(`[ERROR] Missing argument for option: ${option.keyword}`)
        return false
    }

    /** 若正在补全，给出补全推荐 */
    if (comp.completeing && start == args.length - 1 && comp.editing) {
        comp.completeing = false
        comp.response = option.define.args.filter(arg => arg.startsWith(option.value as string))
    }

    /** 消耗一个参数 */
    args.splice(start, 1)

    /** 检查参数是否满足要求 */
    if (!option.define.args.includes(arg)) {
        console.error(`Option ${option.keyword} requires an argument in [${option.define.args.join(', ')}]`)
        return false
    }

    /** 参数合规 */
    option.value = arg
    return true
}

function parseOptionArgCaseCallback(option: CliOption, args: CliArg[], start: number) {
    if (!(option.define.args instanceof Function)) return false

    let correct = true
    option.value = []
    while (true) {
        const arg = args[start]

        /** 命令行参数耗尽 */
        if (!arg) {
            /** 尝试提供补全参数 */
            if (comp.completeing) {
                const result = option.define.complete?.call(undefined, comp.editing ? true : false, option.value)
                if (result instanceof Array) {
                    comp.completeing = false
                    comp.response = result
                }
            }
        }

        /** 尝试接受当前参数 */
        const result = option.define.args([...option.value], (typeof arg === 'string') ? arg : undefined)
        if (!result || typeof arg !== 'string') break

        /** 无论错误与否，只要回调没有明确拒绝此参数，此参数将被接纳 */
        option.value.push(arg)
        args.splice(start, 1)

        /** 若接收参数时出现错误，则报告并记录错误 */
        if (result instanceof Error) {
            console.error(`error parsing argument for option ${option.keyword}: ${result.message}`)
            correct = false
        }
    }

    return correct
}

export function parseOptionArg(option: CliOption, args: CliArg[], start: number) {
    if (!option.define.args) {
        option.value = true
        return true
    }

    if (option.define.args instanceof Array) {
        return parseOptionArgCaseCanddiate(option, args, start)
    }

    if (option.define.args instanceof Function) {
        return parseOptionArgCaseCallback(option, args, start)
    }

    return false
}