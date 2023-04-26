import { execSync } from "child_process"
import { Args, Brief, LongOpt, ShortOpt } from "./decorator"
import { consumeFeatureOptions, consumeGlobalOptions, invokeFeature, locateGlobalElement } from "./execute"
import { Feature } from "./feature"
import { unfoldShortOptions } from "./option"
import { cli, comp } from "./common"

export type CompgenAction = 'alias' | 'arrayvar' | 'binding'
    | 'builtin' | 'command' | 'directory'
    | 'disabled' | 'enabled' | 'export'
    | 'file' | 'function' | 'group'
    | 'helptopic' | 'job' | 'keyword'
    | 'running' | 'service' | 'setopt'
    | 'shopt' | 'signal' | 'stopped'
    | 'user' | 'variableq'


export function Compgen(action: CompgenAction, word = '', cwd = process.cwd()) {
    const cmd = JSON.stringify(`bash -c 'compgen -A ${action} ${word}'`)
    return execSync(`bash -c ${cmd}`, { cwd })
        .toString()
        .split('\n')
        .filter(line => line)
}

class DefaultCompleteFeature extends Feature {
    brief = "display completion script for the application"
    description = "display completion script for the application"

    @LongOpt('--debug') @ShortOpt('-d')
    @Brief('enable debug mode')
    debug = false

    @LongOpt('--base-module')
    @Brief('base module name')
    @Args(() => true)
    baseModule = <string>undefined

    async entry(): Promise<number> {
        if (!this.debug) {
            /** 暂时关闭输出 */
            console.log = console.error = console.info = console.warn = () => { }
        }

        /** 设置开始补全标志 */
        comp.completeing = true

        /** 最后一个单词是否完成编辑 */
        const raw_args = process.env.COMP_LINE.slice(0, parseInt(process.env.COMP_POINT))
        const args = raw_args.split(/\s+/).filter(word => word)
        args.shift()
        if (this.baseModule) args.unshift(this.baseModule)
        comp.editing = raw_args.endsWith(' ')
            ? undefined
            : args[args.length - 1]

        /** 设置了 completeing 后，各阶段回调会启用 Dry Run 模式 */
        while (true) {
            unfoldShortOptions(args)
            if (!comp.completeing) break
            if (!(await consumeGlobalOptions(cli.app, args))) break
            if (!comp.completeing) break
            if (!locateGlobalElement(cli.app, args)) break
            if (!comp.completeing) break
            if (!(await consumeFeatureOptions(cli.element as Feature, args))) break
            if (!comp.completeing) break
            await invokeFeature(cli.element as Feature, args)
            break
        }

        /** 加强过滤 */
        if (comp.editing) {
            comp.response = comp.response.filter(word => word.startsWith(comp.editing))
        }

        /** 将结果写入标准输出流 */
        process.stdout.write(comp.response.map(word => JSON.stringify(word)).join(' '))
        comp.completeing = false
        return 0
    }
}

export const defaultCompleteFeature = new DefaultCompleteFeature()