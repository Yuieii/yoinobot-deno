import { Logger } from "../utils/logger.ts";
import { OBSWebSocket } from "obs-websocket-js";
import { ApiClient } from "@twurple/api";
import { ModuleBase, ModuleBootstrapContext } from "./common.ts";
import { UserIdStore } from "../stores/user_id.ts";
import { Bot } from "../bot.ts";

import type {
    EventSubChannelChatMessageEvent,
    EventSubChannelRedemptionAddEvent
} from "../types/eventsub.ts";
import { EnvError, fromEnv } from "../utils/common.ts";

export class HeadModule extends ModuleBase { 
    public constructor() { 
        super();
    }

    static #logger = Logger.create("HeadModule");
    #isHead: boolean = false;

    #apiClient: ApiClient = null!;
    #streamerUserId: string = null!;
    #botUserId: string = null!;

    public setup(apiClient: ApiClient, streamerUserId: string, botUserId: string) {
        this.#apiClient = apiClient;
        this.#streamerUserId = streamerUserId;
        this.#botUserId = botUserId;
    }

    public override register(bot: Bot, context: ModuleBootstrapContext): void {
        this.setup(bot.appApiClient, context.streamerUserId, context.botUserId);
        this.tryStartOBSConnection();

        bot.eventBus.on("channelChatMessage", async event => { 
            if (event.messageText.match(/^!(簽到|checkin)($|\s)/)) {
                await this.redeemViaChat(event);
            }
        });
        
        bot.eventBus.on("channelRedemptionAdd", async event => {
            if (event.rewardTitle === "簽到") { 
                await this.redeem(event);
            }
        });
    }

    public triggerSignin() {
        const original = this.#isHead;
        this.#isHead = false;
        return original;
    }

    public async tryStartOBSConnection() {
        try {
            const obsHost = fromEnv("OBS_WEBSOCKET_HOST");
            const obsPort = parseInt(fromEnv("OBS_WEBSOCKET_PORT"));
            const obsPassword = fromEnv("OBS_WEBSOCKET_PASSWORD");

            if (Number.isNaN(obsPort) || obsPort < 0 || obsPort > 65535) {
                throw new RangeError(`Port range is invalid! Must be 0-65535, found ${obsPort}`);
            }

            const obsUrl = new URL("ws://0.0.0.0:8000");
            obsUrl.hostname = obsHost;
            obsUrl.port = obsPort.toString();

            const obs = new OBSWebSocket();

            obs.on("CurrentPreviewSceneChanged", (_data) => {
                // console.log("Current preview scene changed:", data);
            });

            obs.on("StreamStateChanged", (data) => {
                HeadModule.#logger.log("Stream state changed:", data);
                if (data.outputActive) {
                    (async () => {
                        const stream = await this.#apiClient.streams.getStreamByUserId(this.#streamerUserId);
                        if (stream === null) {
                            // Stream was offline, but now it's online
                            this.#isHead = true;
                            HeadModule.#logger.log("Enabling !head signin");
                        }
                    })();
                } else if (data.outputState === "OBS_WEBSOCKET_OUTPUT_STOPPED") {
                    (async () => {
                        const stream = await this.#apiClient.streams.getStreamByUserId(this.#streamerUserId);
                        if (stream !== null) {
                            // Stream was online, but now it's offline
                            const botUserId = UserIdStore.get("bot");

                            if (botUserId) {
                                const messages = [
                                    `感謝大家來看台，下次再見囉~~`,
                                    `這次的直播結束啦，宵野嗶啵也有好好完成這次的任務了！獎勵呢？（搖尾巴`,
                                ];

                                const message = messages[Math.floor(Math.random() * messages.length)];
                                await this.#apiClient.chat.sendChatMessageAsApp(botUserId, this.#streamerUserId, message);
                            }
                        }
                    })();
                }
            });

            obs.on("ConnectionOpened", () => {
                HeadModule.#logger.log("OBS WebSocket connection opened.");
            });

            obs.on("ConnectionClosed", (error) => {
                if (error.message.trim() !== "") {
                    HeadModule.#logger.log("OBS WebSocket connection closed: ", error.message);
                }

                setTimeout(() => {
                    this.tryStartOBSConnection(); // Attempt to reconnect after a delay
                }, 1000);
            });

            await obs.connect(obsUrl.toString(), obsPassword);
        } catch (error) {
            // Handled in the "ConnectionClosed" event
            if (error instanceof EnvError || error instanceof RangeError) {
                HeadModule.#logger.error("Error occurred:", error);
                HeadModule.#logger.error("Since this is not a connection error, we won't attempt to reconnect.");
            }
        }
    }

    public async triggerOnce(loginName: string) {
        if (!this.triggerSignin()) {
            return;
        }

        const sendAsBroadcaster = false;

        if (sendAsBroadcaster) {
            // Try to trigger ChiwaBot command with broadcaster privilige.
            // It does not matter if we use the app token variant, because we are using the broadcaster's account.
            // Our !head command currently requires "broadcast themselves" to use.
            await this.#apiClient.chat.sendChatMessage(this.#streamerUserId, `!head ${loginName}`);
        } else {
            // Only do this if only YoinoBot has the permission
            await this.#apiClient.chat.sendChatMessageAsApp(this.#botUserId, this.#streamerUserId, `!head ${loginName}`);
        }

        HeadModule.#logger.log(`The !head has been rewarded to ${loginName}`);
    }

    public async redeem(event: EventSubChannelRedemptionAddEvent) {
        await this.triggerOnce(event.userName);
    }

    public async redeemViaChat(event: EventSubChannelChatMessageEvent) {
        await this.triggerOnce(event.chatterName);
    }
}