import { ApiClient } from "@twurple/api";
import { Bot } from "../bot.ts";
import { ModuleBase, ModuleBootstrapContext } from "./common.ts";
import { EventBus } from "../events.ts";
import { exists } from "@std/fs/exists";
import { Logger } from "../utils/logger.ts";
import { brightGreen, brightYellow } from "@std/fmt/colors";

const FILE_PATH = "./message.json";
const logger = Logger.create("OnceModule");

interface Message { 
    draft?: boolean;
    type: "announce" | "plain";
    text: string;
}

type MessageJson = Message | Message[];

export class OnceModule extends ModuleBase {
    static #watcher: Deno.FsWatcher | null = null;
    static #eventBus = new EventBus();

    #apiClient: ApiClient = null!;
    #appApiClient: ApiClient = null!;
    #streamerUserId: string = null!;
    #botUserId: string = null!;

    #lastTriggeredTime = performance.now();

    static override initialize(): void {
        super.initialize();

        (async () => {
            try {
                await this.#initializeWatcher();
            } catch (error) {
                logger.error("Unhandled error:", error);
            }
        })();
    }

    static override dispose(): void {
        this.#watcher?.close();
    }

    static async #initializeWatcher() {
        if (!(await exists(FILE_PATH))) {
            using file = await Deno.create(FILE_PATH);

            const encoder = new TextEncoder();
            const buffer = encoder.encode("[]");
            await file.write(buffer);
        }

        const watcher = Deno.watchFs(FILE_PATH, {
            recursive: false
        }); 

        this.#watcher = watcher;

        logger.log("Now watching file:", brightGreen(FILE_PATH));

        (async () => { 
            for await (const event of watcher) {
                this.#eventBus.dispatch("fs:onceTrigger", event);
            }
        })();
    }

    public override register(bot: Bot, context: ModuleBootstrapContext): void {
        this.#apiClient = bot.apiClient;
        this.#appApiClient = bot.appApiClient;
        this.#streamerUserId = context.streamerUserId;
        this.#botUserId = context.botUserId;

        OnceModule.#eventBus.on("fs:onceTrigger", async event => { 
            const ev = event as Deno.FsEvent;
            if (ev.kind !== "modify") {
                return;
            }

            if (Math.abs(performance.now() - this.#lastTriggeredTime) < 2000) {
                // logger.warn("FsEvent dispatched too fast! Ignoring...");
                return;
            }

            this.#lastTriggeredTime = performance.now();

            const buffer = await Deno.readFile(FILE_PATH);
            if (buffer.byteLength > 256) {
                logger.warn("Ignoring suspiciously large file...");
                return;
            }

            try {
                const decoder = new TextDecoder("utf-8");
                const payload = JSON.parse(decoder.decode(buffer)) as MessageJson;

                if (typeof payload !== "object") {
                    return;
                }

                const message = (() => {
                    if (payload instanceof Array) {
                        return payload[0];
                    }

                    return payload;
                })();

                if (message.draft) {
                    logger.warn("Ignoring draft message...");
                    return;
                }

                if (message.text.length === 0) {
                    logger.warn("Ignoring empty message...");
                    return;
                }

                logger.log("Detected a message update. Sending...");
            
                switch (message.type) {
                    case "plain":
                        await this.#appApiClient.chat.sendChatMessageAsApp(
                            this.#botUserId, this.#streamerUserId,
                            message.text
                        );
                        break;
                    
                    case "announce":
                        await this.#apiClient.asUser(this.#botUserId, async ctx => {
                            await ctx.chat.sendAnnouncement(this.#streamerUserId, {
                                message: message.text,
                                color: "primary"
                            });
                        });
                        break;
                    
                    default:
                       logger.warn("Unknown message type:", brightYellow(message.type));
                }
                
            } catch (error) {
                logger.error("Failed to parse message file.");
                logger.error(error);
            }
        });
    }
}