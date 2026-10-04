// Minimal cookie header parser. The WebSocket handshake has no Express
// `req.cookies`, so we need to read the auth cookie straight off the header.
export function parseCookieHeader(header) {
    if (!header || typeof header !== "string") return {};

    return header.split(";").reduce((cookies, pair) => {
        const index = pair.indexOf("=");
        if (index < 0) return cookies;

        const key = pair.slice(0, index).trim();
        if (!key) return cookies;

        const value = pair.slice(index + 1).trim();
        try {
            cookies[key] = decodeURIComponent(value);
        } catch {
            cookies[key] = value;
        }
        return cookies;
    }, {});
}

export default { parseCookieHeader };
