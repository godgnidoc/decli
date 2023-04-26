/**
 * @fileoverview 提供基于声明的命令行应用构建框架
 */

export { Application, GetGlobalOptions, verifyDefinitions } from './application'
export { Compgen, CompgenAction, defaultCompleteFeature } from './complete'
export {ShortOpt, LongOpt, Brief, Args, Complete, Required, Repeat} from './decorator'
export { execute } from './execute'
export { Feature } from './feature'
export { defaultHelpFeature } from './help'