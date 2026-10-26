import { Bot } from "../bot.ts";
import { Logger } from "../utils/logger.ts";

import {
    brightYellow
} from "@std/fmt/colors";

const logger = Logger.create("ModuleBase");

export interface ModuleBootstrapContext {
    botUserId: string,
    streamerUserId: string,
}

export class ModuleBase {
    static initialize() {
        logger.log("Initialing module:", brightYellow(this.name));
    }

    static dispose() {
        logger.log("Disposing module:", brightYellow(this.name));
    }

    // deno-lint-ignore no-unused-vars -- Parameter names should be kept for base class
    register(bot: Bot, context: ModuleBootstrapContext) {
        logger.warn("Attempting to register an empty module:", brightYellow(this.constructor.name));
        logger.warn("If this is intentional, override this.");
    }
}