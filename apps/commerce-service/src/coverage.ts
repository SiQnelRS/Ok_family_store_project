import { ServiceUnavailableException } from "@nestjs/common";

export function localCoverage(postalCode: string) {
    const raw = process.env.LOCAL_DELIVERY_RATES_JSON;
    if (!raw?.trim()) return {status: "not_configured"};
    let rates: unknown;
    try { rates = JSON.parse(raw); } catch { throw new ServiceUnavailableException("La cobertura no está disponible temporalmente."); }
    if (!rates || typeof rates !== "object" || Array.isArray(rates)) throw new ServiceUnavailableException("La cobertura no está disponible temporalmente.");
    const entries = Object.entries(rates);
    if (entries.some(([cp, price]) => !/^[0-9]{5}$/.test(cp) || !Number.isSafeInteger(price) || price < 0 || price > 100000000)) throw new ServiceUnavailableException("La cobertura no está disponible temporalmente.");
    if (!entries.length) return {status: "not_configured"};
    const price = (rates as Record<string, number>)[postalCode];
    return price === undefined ? {status: "unavailable"} : {status: "available", priceInCents: price, currency: "MXN"};
}
