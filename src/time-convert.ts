export const secondsToMs = (seconds: number): number => seconds * 1000;

export const minutesToMs = (minutes: number): number => secondsToMs(minutes * 60);

export const hoursToMs = (hours: number): number => minutesToMs(hours * 60);
