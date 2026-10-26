import { AccessToken } from "@twurple/auth";

const botTokenKey = Symbol("YoinoBot.TokenData.Bot");
const streamerTokenKey = Symbol("YoinoBot.TokenData.Streamer");
const store: Record<typeof botTokenKey | typeof streamerTokenKey, Partial<AccessToken>> = {
    [botTokenKey]: {},
    [streamerTokenKey]: {}
};

export const TokenOwner = {
    get BOT(): typeof botTokenKey {
        return botTokenKey;
    },
    get STREAMER(): typeof streamerTokenKey {
        return streamerTokenKey;
    }
};

export type TokenOwnerType = typeof botTokenKey | typeof streamerTokenKey;

export class TokenDataStore {
    public static async setup(owner: TokenOwnerType, result: () => Promise<Partial<AccessToken>>) {
        const token = await result();
        store[owner] = token;
    }   

    public static get(owner: TokenOwnerType): Partial<AccessToken> {
        return store[owner];
    }
}