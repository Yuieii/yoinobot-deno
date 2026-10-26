import type {
    EventSubChannelChatMessageEvent,
    EventSubChannelRedemptionAddEvent
} from "./types/eventsub.ts";

interface EventBusMap { 
    channelRedemptionAdd: EventSubChannelRedemptionAddEvent;
    channelChatMessage: EventSubChannelChatMessageEvent;
}

export class EventBus extends EventTarget {
    public on<K extends keyof EventBusMap>(type: K, listener: (ev: EventBusMap[K]) => void): void;
    public on(type: string, listener: (ev: unknown) => void, options?: boolean | AddEventListenerOptions): void;
    public on(type: string, listener: (ev: unknown) => void, options?: boolean | AddEventListenerOptions): void {
        super.addEventListener(`ue:${type}`, ev => {
            // `ev` should be a CustomEvent since we always use that.
            if (ev instanceof CustomEvent) {
                listener(ev.detail);
            }
        }, options);
    }

    public dispatch<K extends keyof EventBusMap>(type: K, payload: EventBusMap[K]): void;
    public dispatch(type: string, payload: unknown): void;
    public dispatch(type: string, payload: unknown): void {
        super.dispatchEvent(new CustomEvent(`ue:${type}`, {
            detail: payload
        }));
    }
}