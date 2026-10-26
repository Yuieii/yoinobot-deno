import {
    brightGreen, brightRed,
    brightYellow, brightBlack,
} from "@std/fmt/colors";

export interface ILogger { 
    log(...data: unknown[]): void;
    warn(...data: unknown[]): void;
    error(...data: unknown[]): void;
}

function enumSet<K extends string>(arr: K[]) {
    return arr;
}

const logKeys = enumSet([
    "log", "error", "warn"
]);

export const Logger = { 
    create(name: string): ILogger { 
        return new Proxy(console, {
            get(target, prop: (typeof logKeys)[number], _receiver) {
                if (logKeys.indexOf(prop) >= 0) {
                    return target.log.bind(target,
                        brightBlack(new Date().toISOString()),
                        ({
                            log: brightGreen,
                            warn: brightYellow,
                            error: brightRed,
                        }[prop])(`[${name}]`),
                    );
                }
            }
        })
    }
};