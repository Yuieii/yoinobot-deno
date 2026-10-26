export class EnvError extends Error {

}

export function fromEnv(env: string) {
    const result = Deno.env.get(env);
    if (result) return result;

    throw new EnvError(`${env} is not set! Provide it via .env!`);
}

export function delay(millis: number): Promise<void> { 
    return new Promise(resolve => {
        setTimeout(() => resolve(), millis);
    });
}