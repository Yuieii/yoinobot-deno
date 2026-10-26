import { Logger } from "../utils/logger.ts";
import { ApiClient } from "@twurple/api";
import { ModuleBase, ModuleBootstrapContext } from "./common.ts";
import { Bot } from "../bot.ts";

import type {
    EventSubChannelRedemptionAddEvent
} from "../types/eventsub.ts";

import {
    BOT_USERNAME
} from "../constants.ts";

import {
    brightGreen
} from "@std/fmt/colors";

export class LoveYuiModule extends ModuleBase {
    // public constructor(private chatClient: ChatClient, private streamerUsername: string) {}
    public constructor() { 
        super();
    }

    static #logger = Logger.create("LoveYuiModule");

    #lowOutput: boolean = false;
    #lowRollTrigger = 70;
    #bombRoundCounter = -1;
    #bombRoundUpperLimit = 5;

    #apiClient: ApiClient = null!;
    #streamerUserId: string = null!;
    #botUserId: string = null!;

    public setup(apiClient: ApiClient, streamerUserId: string, botUserId: string) {
        this.#apiClient = apiClient;
        this.#streamerUserId = streamerUserId;
        this.#botUserId = botUserId;
    }

    public override register(bot: Bot, context: ModuleBootstrapContext): void {
        const { streamerUserId: userId, botUserId } = context;
        this.setup(bot.appApiClient, userId, botUserId);

        bot.eventBus.on("channelChatMessage", async event => { 
            if (event.messageText.match(/^!自愛($|\s)/) && event.chatterId === userId) {
                await this.triggerOnce(BOT_USERNAME);
            }
        });

        bot.eventBus.on("channelRedemptionAdd", async event => {
            if (event.rewardTitle === "愛悠依") {
                await this.redeem(event);
                return;
            }

            if (event.rewardTitle === "埋地雷") {
                await this.setupMine(event);
                return;
            }
        });
    }

    public random() {
        const upperBound = this.#lowOutput ? 10 : 100;

        const storage = new Uint32Array(2);
        global.crypto.getRandomValues(storage);
        const first = storage[0] % (upperBound + 1); // Math.floor(Math.random() * (upperBound + 1));

        const randBool = (storage[1] / 4294967296) < 0.5;

        if (this.#bombRoundCounter >= 0) { 
            const counter = this.#bombRoundCounter;
            this.#bombRoundCounter--;

            LoveYuiModule.#logger.log("Bomb counter decreased to", brightGreen(`${this.#bombRoundCounter}`));

            if (counter === 0) {
                return randBool ? 0 : 100;
            }
        }

        // You know what?
        // Sometimes when we roll a 0, I want it to be 100 instead
        if (!this.#lowOutput && first == 0 && randBool) {
            this.#lowOutput = true;
            return 100;
        }

        this.#lowOutput = false;

        if (first >= this.#lowRollTrigger) {
            this.#lowOutput = true;
        }

        return first;
    }

    public async setupMine(event: EventSubChannelRedemptionAddEvent) {
        const storage = new Uint32Array(1);
        global.crypto.getRandomValues(storage);
        this.#bombRoundCounter = storage[0] % this.#bombRoundUpperLimit;
        LoveYuiModule.#logger.log("Bomb counter set to", brightGreen(`${this.#bombRoundCounter}`));

        await this.#apiClient.chat.sendChatMessageAsApp(this.#botUserId, this.#streamerUserId,
            `@${event.userDisplayName} 埋下了一顆不定時炸彈... 隨機 1~${this.#bombRoundUpperLimit} 次內必定產生 0% 或 100% 愛悠依`
        );
    }

    public async triggerOnce(displayName: string) { 
        const randomNumber = this.random();
        let message = `@${displayName} 這次有 ${randomNumber}% 愛悠依`;

        switch (randomNumber) {
            case 0:
                message = `@${displayName} 這次沒有愛悠依 :(`;
                break;
            
            case 100:
                message = `@${displayName} 這次有 ${randomNumber}% 愛悠依...嗯？`;
                break;
            
            default:
                if (randomNumber >= 80) {
                    message = `@${displayName} 這次有 ${randomNumber}% 愛悠依，可以說是非常愛悠依`;
                    break;
                }

                if (randomNumber >= this.#lowRollTrigger) { 
                    message = `@${displayName} 這次有 ${randomNumber}% 愛悠依，好像是有點愛悠依`;
                    break;
                }
        }

        await this.#apiClient.chat.sendChatMessageAsApp(this.#botUserId, this.#streamerUserId, message);
    }

    public async redeem(event: EventSubChannelRedemptionAddEvent) {
        await this.triggerOnce(event.userDisplayName);
    }
}