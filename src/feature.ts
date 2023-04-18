export abstract class Feature {
    /** 功能简介 */
    brief?: string

    /** 详细介绍 */
    description?: string

    /** 功能入口是否接受参数 */
    args?: boolean

    /** 
     * 参数自动补全 
     * @param editing 是否正在编辑最后一个参数
     * @param args 已经输入的参数
     */
    complete?: (editing: boolean, args: string[]) => string[] | Promise<string[]>

    /** 功能入口 */
    abstract entry(...args: string[]): number | Promise<number>
}