import { comp } from "./common"
import { GetOptionDescTable, Option } from "./option"

export type CliArg = string | CliOption | CliElePath
export type CliOption = { is: 'option', keyword: string, define: Option, value: boolean | string | string[] }
export type CliElePath = { is: 'path', path: string[] }
export type ArgPass = (arg: string) => Error | boolean

export function parseOptionArg(option: CliOption, args: CliArg[], start: number) {
    if (!option.define.arg) {
        option.value = true
        return true
    }

    const arg = args[start]

    /** 若正在补全，给出补全推荐 */
    if (comp.completeing && comp.editing && !arg) {
        const defines = GetOptionDescTable(option.define.target)
        const keywords = [
            ...Object.values(defines).map(define => define.long),
            ...Object.values(defines).map(define => define.short)
        ].filter(keyword => keyword)
            .filter(keyword => keyword.startsWith(option.keyword))
        comp.response.push(...keywords)
    }


    if (typeof arg !== 'string') {
        console.error(`Missing argument for option: ${option.keyword}`)
        return false
    }

    /** 若正在补全，给出补全推荐 */
    if( comp.completeing && comp.editing && start == args.length - 1 ) {
        if( option.define.arg instanceof Array) {
            comp.response.push(...option.define.arg.filter(can => can.startsWith(arg as string)))
        }
        if( option.define.arg instanceof Function ) {
            if( option.define.complete ) {
                comp.response.push(...option.define.complete().filter(can => can.startsWith(arg as string)))
            }
        }
        comp.completeing = false
    }

    args.splice(start, 1)
    

    if (option.define.arg instanceof Array) {
        /** 检查参数是否满足要求 */
        if (!option.define.arg.includes(arg)) {
            console.error(`Option ${option.keyword} requires an argument in [${option.define.arg.join(', ')}]`)
            return false
        }
    
        option.value = arg
        return true
    }

    if (option.define.arg instanceof Function) {
        const result = option.define.arg(arg)
        if (!result) {
            console.error(`Invalid argument for option: ${option.keyword}`)
            return false
        }
    
        if (result instanceof Error) {
            console.error(`${result.message}`)
            return false
        }
    
        option.value = arg
        return true
    }

    return false
}