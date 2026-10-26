import { EventSubWsListener } from "@twurple/eventsub-ws";
import type { LastInArray } from "../utils/types.ts";

interface EventKeys {
    onChannelRedemptionAdd: unknown;
    onChannelChatMessage: unknown;
}

type EventHandlerArg<K extends keyof EventKeys> = Parameters<LastInArray<Parameters<EventSubWsListener[K]>>>[0];

export type EventSubChannelRedemptionAddEvent = EventHandlerArg<"onChannelRedemptionAdd">;
export type EventSubChannelChatMessageEvent = EventHandlerArg<"onChannelChatMessage">;