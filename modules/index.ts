import { ModuleBase } from "./common.ts";
import { HeadModule } from "./head.ts";
import { LoveYuiModule } from "./love_yui.ts";
import { OnceModule } from "./once.ts";

export const modules: (typeof ModuleBase)[] = [
    HeadModule,
    LoveYuiModule,
    OnceModule,
];