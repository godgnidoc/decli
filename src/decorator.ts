import { ArgPass } from "./argument"
import { GetOptionDesc } from "./option"

export function ShortOpt(opt: string) {
    return (target: any, propertyKey: string) => {
        GetOptionDesc(target, propertyKey).short = opt
    }
}

export function LongOpt(opt: string) {
    return (target: any, propertyKey: string) => {
        GetOptionDesc(target, propertyKey).long = opt
    }
}

export function Brief(brief: string) {
    return (target: any, propertyKey: string) => {
        GetOptionDesc(target, propertyKey).brief = brief
    }
}

export function Args(args: string[] | ArgPass) {
    return (target: any, propertyKey: string) => {
        GetOptionDesc(target, propertyKey).arg = args
    }
}

export function Complete(complete: (() => string[])) {
    return (target: any, propertyKey: string) => {
        GetOptionDesc(target, propertyKey).complete = complete
    }
}

export function Required() {
    return (target: any, propertyKey: string) => {
        GetOptionDesc(target, propertyKey).required = true
    }
}

export function Repeat() {
    return (target: any, propertyKey: string) => {
        GetOptionDesc(target, propertyKey).repeat = true
    }
}