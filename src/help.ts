import { Element, IsElement, IsFeature, IsModule, locateElement } from "./application"
import { cli } from "./common"
import { Feature } from "./feature"
import { GetOptionDescTable, Option } from "./option"

class DefaultHelpFeature extends Feature {
    constructor() {
        super()
        this.brief = "display this help page"
        this.description = "display help information for the application or a feature"
        this.args = '[feature|module]'
    }

    complete = (editing: boolean, args: string[]) => {
        const [element, path] = locateElement(args)
        if (path.length == args.length) {
            if (IsModule(element)) {
                if (editing) {
                    const mod = locateElement(args.slice(0, -1))[0]
                    return Object.keys(mod)
                        .filter(key => IsElement(mod[key]))
                        .filter(key => key.startsWith(args[args.length - 1]))
                } else {
                    return Object.keys(element)
                        .filter(key => IsElement(element[key]))
                }
            }
        } else if (path.length == args.length - 1) {
            if (IsModule(element)) {
                return Object.keys(element)
                    .filter(key => IsElement(element[key]))
                    .filter(key => key.startsWith(args[args.length - 1]))
            }
        }
        return []
    }

    entry(...args: string[]): number {
        if (args.length === 0) {
            this.showBriefHelp()
        } else {
            const element = locateElement(args)[0]
            if (IsFeature(element)) {
                this.showFeatureHelp(element, args.join(' '))
            } else if (IsModule(element)) {
                this.showModuleHelp(element)
            } else {
                console.error(`Unknown feature or module '${args.join('.')}'`)
                return -1
            }
        }
        return 0
    }

    private showBriefHelp() {
        if (cli.app.brief) {
            console.log(`${cli.app.name} - ${cli.app.version} - ${cli.app.brief}`)
        }

        const options = GetOptionDescTable(cli.app.options)
        console.log(`Usage: ${cli.app.name} [global-options] [module...] feature] [options] [args]`)

        if (cli.app.description) {
            console.log()
            console.log(`Description:`)
            console.log(cli.app.description)
        }
        if (options) {
            console.log()
            console.log(`Global options:`)
            this.showOptionsHelp(options)
        }

        if (IsModule(cli.app.elements)) {
            console.log()
            this.showModuleHelp(cli.app.elements)
        }
    }

    private showOptionsHelp(options: { [key: string]: Option }) {
        for (const option of Object.values(options)) {
            const switchs = [option.short, option.long].filter(o => o).join(', ')
            const args = option.arg === undefined
                ? ''
                : option.arg instanceof Array
                    ? (' <' + option.arg.join('|') + '>')
                    : ' <...>'
            const required = option.required ? '[REQUIRED] ' : ''
            const brief = option.brief ? ` --- ${option.brief}` : ''

            console.log(`  ${required}${switchs}${args}${brief}`)
        }
    }

    private showFeatureHelp(feature: Feature, path: string) {
        const g_options = GetOptionDescTable(cli.app.options)
        const f_options = GetOptionDescTable(feature)

        const args = typeof feature.args === 'string'
            ? feature.args
            : feature.args
                ? '...'
                : ''

        console.log(`Usage: ${cli.app.name} [global-options] ${path} [options] ${args}`)

        if (feature.description) {
            console.log()
            console.log(`Description:`)
            console.log(`  ${feature.description}`)
        }

        if (f_options) {
            console.log()
            console.log(`Feature options:`)
            this.showOptionsHelp(f_options)
        }

        if (g_options) {
            console.log()
            console.log(`Global options:`)
            this.showOptionsHelp(g_options)
        }
    }

    private showModuleHelp(module: { [key: string]: Element }) {
        const alias: { [name: string]: string[] } = {}
        for (const [name, element] of Object.entries(module)) {
            let collapsed = false
            if (IsFeature(element)) {
                for (const key in alias) {
                    if (element == module[key]) {
                        alias[key].push(name)
                        collapsed = true
                        break
                    }
                }
                if (!collapsed) {
                    alias[name] = [name]
                }
            }
        }

        let feature_title = false
        for (const [key, names] of Object.entries(alias)) {
            if (!feature_title) {
                feature_title = true
                console.log(`Features:`)
            }
            const name = names.join(', ')
            console.log(`  ${name} --- ${module[key].brief}`)
        }

        let sub_title = false
        for (const [name, element] of Object.entries(module)) {
            if (IsModule(element)) {
                if (!sub_title) {
                    sub_title = true
                    if (feature_title) console.log()
                    console.log(`Sub modules:`)
                }
                console.log(`  ${name} ...`)
            }
        }
    }
}

export const defaultHelpFeature = new DefaultHelpFeature