import { Application, Element, IsElement, IsFeature, IsModule, locateElement } from "./application"
import { CliArg, CliElePath } from "./argument"
import { cli, comp } from "./common"
import { Feature } from "./feature"
import { GetOptionDescTable, parseOptions, unfoldShortOptions } from "./option"

/** 
 * 执行应用
 * - 指令结构 `app [global-options] [[module...] feature] [options] [args]`
 * - 选项和功能参数的顺序不影响解析结果，但选项的参数必须紧跟在选项后面
 * - 若功能处于模块中，则模块名必须在功能名之前，功能选项必须出现在功能路径之后
 * - 短选项均由一个连字符 `-` 开头，且仅接受一个字母，短选项允许合并
 * - 长选项至少由两个连字符 `--` 开头，且至少接受一个字母
 * - 带参数的短选项若参与合并，必须放在合并后的最后一个短选项后面
 * @param app 应用描述符
 * @param args 命令行参数，应当仅包含参数，不包含命令本身
 * @return 返回值为 0 表示正常退出，否则表示异常退出
 */
export async function execute(app: Application, args: string[]): Promise<number> {
    cli.app = app
    cli.options = app.options || {}

    unfoldShortOptions(args)

    if (!(await consumeGlobalOptions(app, args))) {
        console.error(`Failed to parse global options.`)
        return -1
    }

    if (!locateGlobalElement(app, args)) {
        console.error(`Failed to locate entry point.`)
        return -1
    }

    if (!(await consumeFeatureOptions(cli.element as Feature, args))) {
        console.error(`Failed to parse options.`)
        return -1
    }

    if (app.entry) {
        const ret = await app.entry()
        if (ret != 0) return ret
    }

    return await invokeFeature(cli.element as Feature, args)
}

export async function consumeGlobalOptions(app: Application, args: CliArg[]) {
    let correct = true
    const defines = GetOptionDescTable(app.options)
    if (typeof defines === 'object') {
        correct = (await parseOptions(app.options, defines, args)) && correct
    }
    return correct
}

export async function consumeFeatureOptions(feature: Feature, args: CliArg[]) {
    let correct = true
    const defines = GetOptionDescTable(feature)
    if (typeof defines === 'object') {
        correct = (await parseOptions(feature, defines, args)) && correct
    }
    return correct
}

export function locateGlobalElement(app: Application, args: CliArg[]) {
    /** 默认指向主入口 */
    [cli.element, cli.path] = app.main ? locateElement(app.main.split('.')) : [undefined, []]

    /** 尝试跳过路径开始之前的全局选项 */
    let it = 0
    while (it < args.length) {
        if (typeof args[it] === 'string') {
            /** 若命令行参数已经进入指令参数阶段，则放弃检测 */
            if (cli.app.options_end && args[it] === cli.app.options_end) return IsFeature(cli.element)
            break
        }
        it += 1
    }

    /** 若命令行参数耗尽时还没找到合规的字符串作为路径开头，则尝试补全全部入口 */
    if (!args[it] && !cli.element && comp.completeing) {
        comp.response.push(
            ...Object.keys(app.elements)
                .filter(key => IsElement(app.elements[key]))
        )
        return
    }

    const start = args[it] as string
    let matched = false
    if (IsElement(app.elements[start])) {
        const ele: CliElePath = { is: "path", path: [] }
        args.splice(it++, 1, ele, start)

        cli.element = app.elements
        cli.path = ele.path
        while (typeof args[it] == 'string' && IsModule(cli.element)) {
            const key = args[it] as string
            if (!IsElement(cli.element[key])) break
            cli.element = cli.element[key]
            ele.path.push(key)
            args.splice(it, 1)
        }

        matched = IsFeature(cli.element)
    }

    if (comp.completeing && !matched) {
        if (!args[it]) {
            if (comp.editing) {
                const [parent, _] = locateElement(cli.path.slice(0, -1))
                const name = cli.path[cli.path.length - 1]
                comp.response.push(
                    ...Object.keys(parent)
                        .filter(key => IsElement(parent[key]) && key.startsWith(name))
                )
            } else {
                const element = (cli.element || cli.app.elements) as Element
                comp.response.push(
                    ...Object.keys(element)
                        .filter(key => IsElement(element[key]))
                )
            }
        } else {
            const element = (cli.element || cli.app.elements) as Element
            const last = args[it]
            if (it < args.length - 1) return
            if (typeof last !== 'string') return
            if (!comp.editing) return

            comp.response.push(
                ...Object.keys(element)
                    .filter(key => IsElement(element[key]) && key.startsWith(last))
            )
        }
    }

    return IsFeature(cli.element)
}

export async function invokeFeature(feature: Feature, args: CliArg[]): Promise<number> {

    /** 清理命令行参数列表 */
    for (let i = 0; i < args.length; i++) {
        const arg = args[i]
        if(typeof arg !== 'string') {
            args.splice(i--, 1)
        } else if (cli.app.options_end && arg === cli.app.options_end) {
            args.splice(i, 1)
            break
        }
    }

    /** 若命令行携带非预期的参数则报错 */
    if (!feature.args && args.length > 0) {
        console.error(`Expecting no arguments, but got ${args.length} arguments`)
        return -1
    }

    /** 正常调用接口回调 */
    if (!comp.completeing) return await feature.entry.apply(feature, args)

    /** 尝试给出自动补全提示 */
    if (feature.complete) {
        const result = await feature.complete(comp.editing ? true : false, args as string[])
        if (result) comp.response.push(...result)
    }
}