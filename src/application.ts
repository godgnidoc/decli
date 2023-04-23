import { cli } from "./common"
import { Feature } from "./feature"
import { GetOptionDescTable, verifyOptionDefinitions } from "./option"
export type Element = Feature | { [key: string]: Element }

/**
 * 应用基本结构
 */
export interface Application {
    /** 应用名 */
    readonly name: string

    /** 应用版本号 */
    readonly version: string

    /** 应用元素列表 */
    readonly elements: { [key: string]: Element }

    /** 应用默认功能点分路径 */
    readonly main?: string

    /** 
     * 应用主入口，若设置，则在调用特性之前先执行此入口
     * 若此入口返回非零，则放弃调用特性入口
     */
    readonly entry?: () => number | Promise<number>

    /** 简介 */
    readonly brief?: string

    /** 详细介绍 */
    readonly description?: string

    /** 选项列表 */
    readonly options?: any

    /** 可以指定一个标志表示选项结束，后续命令行参数全被用作功能参数 */
    readonly options_end?: string

    /** 帮助功能入口点分路径 */
    readonly help?: string
}

/**
 * 获取全局选项
 */
export function GetGlobalOptions() {
    return cli.options
}

export function IsModule(obj: any): obj is { [key: string]: Feature } {
    const sure = obj instanceof Object && (obj.__is_module__ === true || Object.values(obj).some(f => f instanceof Feature))
    if (sure) obj.__is_module__ = true
    return sure
}

export function IsFeature(obj: any): obj is Feature {
    return obj instanceof Feature
}

export function IsElement(obj: any): obj is Element {
    return IsModule(obj) || IsFeature(obj)
}

export function IsApplication(obj: any): obj is Application {
    return obj === cli.app
}


export function locateElement(path: string[]): [Element, string[]] {
    let element: Element = cli.app.elements
    const realy: string[] = []
    for (const key of path) {
        if (!IsModule(element) || !IsElement(element[key])) break
        realy.push(key)
        element = element[key]
    }
    return [element, realy]
}

export function verifyDefinitions(module: any, global_names = new Set<string>()) {
    let correct = true

    if (IsApplication(module)) {
        if (module.main) {
            /** 检查默认入口 */
            const path = module.main.split('.')
            const element = locateElement(path)[0]
            if (!IsFeature(element)) {
                console.error(`Default entry '${module.main}' not found.`)
                correct = false
            }
        }
        /** 扫描全局选项 */
        const g_options = GetOptionDescTable(module.options)
        if (g_options)
            correct = verifyOptionDefinitions(g_options, global_names) && correct

        /** 扫描功能和子模块 */
        correct = verifyDefinitions(module.elements, global_names) && correct
    } else if (IsFeature(module)) {
        /** 允许重复定义功能 */
        if (cli.features.has(module)) return correct
        cli.features.add(module)

        const options = GetOptionDescTable(module)
        const local_names = new Set<string>(global_names)
        if (typeof options === 'object')
            correct = verifyOptionDefinitions(options, local_names) && correct
    } else if (IsModule(module)) {
        const local_names = new Set<string>(global_names)
        /** 扫描功能和子模块 */
        for (const key in module) {
            const feature = module[key]
            if (!IsFeature(feature) && !IsModule(feature)) continue

            if (local_names.has(key)) {
                console.error(`Duplicate definition: ${key}`)
                correct = false
                continue
            }
            local_names.add(key)
            correct = verifyDefinitions(feature, local_names) && correct
        }
    }

    return correct
}