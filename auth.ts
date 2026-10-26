import { AccessToken, AuthProvider, RefreshingAuthProvider } from "@twurple/auth";
import { Logger } from "./utils/logger.ts";
import { TokenDataStore, TokenOwner } from "./stores/token_data.ts";
import { exists } from "@std/fs/exists";
import { brightYellow } from "@std/fmt/colors";

import {
    CLIENT_ID,
    CLIENT_SECRET,
    BOT_TOKEN_FILE,
    STREAMER_TOKEN_FILE, 

    REDIRECT_URI_PORT,
    REDIRECT_URI_BASE,
} from "./constants.ts";

function listenForCode(path: string) {
    return new Promise<Omit<AccessToken, "obtainmentTimestamp">>(resolve => { 
        const server = Deno.serve({ port: REDIRECT_URI_PORT }, async (req) => {
            const logger = Logger.create("AuthHttpServer");
            const url = new URL(req.url);
            const code = url.searchParams.get("code");

            if (!code) {
                return new Response("Missing code parameter", { status: 400 });
            }

            if (url.pathname !== path) {
                logger.log(url.pathname);
                return new Response("Invalid path", { status: 400 });
            }

            logger.log("Received code:", code);

            const tokenResponse = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&code=${code}&grant_type=authorization_code&redirect_uri=${encodeURIComponent(REDIRECT_URI_BASE + path)}`, {
                method: "POST",
            });
            const tokenOAuthData = await tokenResponse.json();
            
            logger.log("Received OAuth2 response. Saving credentials...");

            resolve({
                accessToken: tokenOAuthData.access_token,
                refreshToken: tokenOAuthData.refresh_token,
                expiresIn: tokenOAuthData.expires_in,
                scope: tokenOAuthData.scope
            });

            setTimeout(() => {
                server.shutdown();
            }, 1);

            return new Response("Authorization successful! You can close this window.", { status: 200 });
        });
    });
}
    
async function ensureTokenAuthenticated(tokenFile: string, scopes: string[], path: string): Promise<Partial<AccessToken>> { 
    const logger = Logger.create("TokenAuth")
    let tokenData = {} as Partial<AccessToken>;
    
    if (!(await exists(tokenFile))) {
        logger.warn("Token file", brightYellow(tokenFile), "not found!");
    } else {
        try {
            tokenData = JSON.parse(await Deno.readTextFile(tokenFile));
        } catch (error) {
            logger.error(`Error reading token file ${tokenFile}:`, error);
        }
    }

    if (!tokenData || !tokenData.accessToken || !tokenData.refreshToken) { 
        logger.log("Please authorize the application by visiting the following URL:");
        logger.log(`https://id.twitch.tv/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI_BASE + path)}&response_type=code&scope=${scopes.map(r => encodeURIComponent(r)).join("+")}`);
        
        tokenData = await listenForCode(path);
        await Deno.writeTextFile(tokenFile, JSON.stringify(tokenData, null, 4));
    }

    return tokenData;
}

export async function ensureAuthenticated() {
    await TokenDataStore.setup(TokenOwner.BOT, async () => { 
        return await ensureTokenAuthenticated(BOT_TOKEN_FILE, [
            "chat:read",
            "chat:edit",
            "user:read:chat",
            "user:write:chat",
            "user:bot",
            "moderator:manage:announcements"
        ], "/bot");
    });

    await TokenDataStore.setup(TokenOwner.STREAMER, async () => { 
        return await ensureTokenAuthenticated(STREAMER_TOKEN_FILE, [
            "chat:read",
            "chat:edit",
            "user:read:chat",
            "user:write:chat",
            "channel:read:redemptions",
            "user:bot",
            "channel:bot",
            "moderator:manage:announcements"
        ], "/streamer");
    });
}

export async function setupAuthProvider(authProvider: AuthProvider) {
    if (authProvider instanceof RefreshingAuthProvider) {
        await authProvider.addUserForToken(TokenDataStore.get(TokenOwner.BOT) as AccessToken, ["chat"]);
        await authProvider.addUserForToken(TokenDataStore.get(TokenOwner.STREAMER) as AccessToken, []);
    }
}