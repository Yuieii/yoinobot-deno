import { Bot } from "./bot.ts";
import { Logger } from "./utils/logger.ts";

try {
    const bot = new Bot();
    await bot.initialize();
    await bot.start();
} catch (error) {
    const logger = Logger.create("Error");
    logger.error("Unhandled error:", error);

    logger.error("--");
    logger.error("The bot will now quit.");
}