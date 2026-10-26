import { AppTokenAuthProvider, RefreshingAuthProvider } from "@twurple/auth";
import { ApiClient } from "@twurple/api";
import { EventSubWsListener } from "@twurple/eventsub-ws";
import { EventSubHttpListener, ReverseProxyAdapter } from "@twurple/eventsub-http";
import { modules } from "./modules/index.ts";
import { UserIdStore } from "./stores/user_id.ts";
import { EventBus } from "./events.ts";
import { Logger } from "./utils/logger.ts";
import { ModuleBase } from "./modules/common.ts";
import { brightGreen, brightCyan, brightYellow } from "@std/fmt/colors";

import type { Class } from "./utils/types.ts";

import {
    CLIENT_ID,
    CLIENT_SECRET,
    BOT_TOKEN_FILE,
    STREAMER_TOKEN_FILE,
    STREAMER_USERNAME,
    BOT_USERNAME,
    VERSION,
} from "./constants.ts";

import {
    ensureAuthenticated,
    setupAuthProvider
} from "./auth.ts"
import { fromEnv } from "./utils/common.ts";

export class ModuleStore {
    #bot: Bot;
    #modules: ModuleBase[] = [];
    #logger = Logger.create("ModuleStore");

    public constructor(bot: Bot) {
        this.#bot = bot;
    }

    public register<T extends ModuleBase>(type: Class<T, [], typeof ModuleBase>): T {
        if (this.#modules
            .map(t => t.constructor.name)
            .includes(type.name))
        {
            this.#logger.warn("Ignored duplicated module:", brightYellow(type.name));
            return this.get(type);
        }
        
        type.initialize();

        const module = new type();
        module.register(this.#bot, {
            streamerUserId: UserIdStore.get("streamer")!,
            botUserId: UserIdStore.get("bot")!
        });
        this.#modules.push(module);

        return module;
    }

    public unregister() {
        this.#logger.warn("The feature of unregistering modules is currently unimplemented.");
    }

    public getOptional<T extends ModuleBase>(type: Class<T>): T | null {
        for (const module of this.#modules) {
            if (module instanceof type) {
                return module;
            }
        }

        return null;
    }

    public get<T extends NonNullable<ModuleBase>>(type: Class<T>): T {
        const result = this.getOptional(type);
        if (result == null) {
            throw new Error(`The specified service ${type.name} is not registered yet.`);
        }

        return result;
    }
}

export class Bot {
    #logger = Logger.create("YoinoBot");
    #moduleStore: ModuleStore;
    #eventBus = new EventBus();
    
    #apiClient: ApiClient | null = null;
    #appApiClient: ApiClient | null = null;
    
    public constructor() {
        this.#logger.log(`YoinoBot`, brightYellow(`v${VERSION}`))
        this.#moduleStore = new ModuleStore(this);
    }

    public get moduleStore() {
        return this.#moduleStore;
    }

    public async initialize() {
        this.#logger.log("Verifying token presence...");
        await ensureAuthenticated();
    }

    public get eventBus() {
        return this.#eventBus;
    }

    public get apiClient() {
        if (this.#apiClient === null) {
            throw new Error("Bot has not been started yet.");
        }

        return this.#apiClient;
    }

    public get appApiClient() {
        if (this.#appApiClient === null) {
            throw new Error("Bot has not been started yet.");
        }

        return this.#appApiClient;
    }

    public async start() {
        this.#logger.log("Starting YoinoBot...")

        const authProvider = new RefreshingAuthProvider({
            clientId: CLIENT_ID,
            clientSecret: CLIENT_SECRET
        });

        const appTokenProvider = new AppTokenAuthProvider(CLIENT_ID, CLIENT_SECRET);

        await setupAuthProvider(authProvider);
        await setupAuthProvider(appTokenProvider);

        const apiClient = new ApiClient({ authProvider });
        const appApiClient = new ApiClient({ authProvider: appTokenProvider });

        const proxyHost = fromEnv("REVERSE_PROXY_HOST");
        const proxyPort = fromEnv("REVERSE_PROXY_PORT");
        const eventSubHttpSecret = fromEnv("EVENTSUB_HTTP_SECRET");

        const appListener = new EventSubHttpListener({
            apiClient: appApiClient,
            adapter: new ReverseProxyAdapter({
                hostName: proxyHost,
                port: parseInt(proxyPort)
            }),
            secret: eventSubHttpSecret
        });

        appListener.start();
        this.#logger.log("Using EventSub listener with reverse proxy:", brightYellow(`${proxyHost}:${proxyPort}`));

        const listener = new EventSubWsListener({ apiClient });
        listener.start();

        const user = await appApiClient.users.getUserByName(STREAMER_USERNAME);
        this.#logger.log("User:", brightCyan(`${user?.displayName} (${user?.name})`), "ID:", brightGreen(`${user?.id}`));
        const userId = user?.id!;

        const botUser = await appApiClient.users.getUserByName(BOT_USERNAME);
        this.#logger.log("Bot user:", brightCyan(`${botUser?.displayName} (${botUser?.name})`), "ID:", brightGreen(`${botUser?.id}`));
        const botUserId = botUser?.id!;

        authProvider.onRefresh(async (userId, newTokenData) => {
            const fileName = userId === botUserId ? BOT_TOKEN_FILE : STREAMER_TOKEN_FILE;
            await Deno.writeTextFile(fileName, JSON.stringify(newTokenData, null, 4));
        });

        UserIdStore.set("streamer", userId);
        UserIdStore.set("bot", botUserId);

        listener.onChannelChatMessage(userId, botUserId, (event) => {
            this.eventBus.dispatch("channelChatMessage", event);
        });

        // Can't really receive any event for some reason, but required for the bot to appear in chat list as a chat bot
        appListener.onChannelChatMessage(userId, botUserId, (event) => {
            this.#logger.log("EventSub chat event received via app token:", event);
            // eventBus.dispatch("channelChatMessage", event);
        });

        listener.onStreamOffline(userId, _ => { 
            this.#logger.log("Now went offline!");
        });
        
        listener.onChannelRedemptionAdd(userId, (event) => {
            this.eventBus.dispatch("channelRedemptionAdd", event);
        });

        this.#apiClient = apiClient;
        this.#appApiClient = appApiClient;

        this.#logger.log("Chat client connected and listening for messages...");

        for (const moduleType of modules) {
            this.#moduleStore.register(moduleType);
        }
    }
}