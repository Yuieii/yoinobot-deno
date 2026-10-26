import { fromEnv } from "./utils/common.ts";

export const VERSION = "0.0.1";

export const CLIENT_ID = fromEnv("CLIENT_ID");
export const CLIENT_SECRET = fromEnv("CLIENT_SECRET");

export const BOT_TOKEN_FILE = "./tokens.bot.json";
export const STREAMER_TOKEN_FILE = "./tokens.streamer.json";

export const REDIRECT_URI_PORT = (() => {
    const str = fromEnv("OAUTH_LISTEN_PORT");
    const num = parseInt(str);
    if (Number.isNaN(num)) {
        throw new Error(`Invalid OAuth2 port: ${str}`);
    }

    return num;
})();

export const REDIRECT_URI_BASE = `http://localhost:${REDIRECT_URI_PORT}`;

export const STREAMER_USERNAME = "yuieii_";
export const BOT_USERNAME = "yoinobot";