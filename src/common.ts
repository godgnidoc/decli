import { Application, Element } from "./application"
import { Feature } from "./feature"

export const comp = {
    /** 正在执行自动补全 */
    completeing: false,

    /** 执行自动补全时，光标尚未离开最后一个单词 */
    editing: <string>undefined,

    /** 自动补全的响应结果 */
    response: <string[]>[]
}

export const cli = {
    app: <Application>undefined,
    options: <any>undefined,
    path: <string[]>undefined,
    element: <Element>undefined,
    features: new Set<Feature>()
}
