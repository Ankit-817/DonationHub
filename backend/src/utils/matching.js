// Default search radius (km) used for donation <-> request matching.
// Configurable via env so it can be tuned without a code change.
const DEFAULT_MATCH_DISTANCE_KM = Number(process.env.MATCH_DISTANCE_KM) || 25;

// Haversine distance between two [lng, lat] GeoJSON-style points, in km.
const distanceKm = ([lng1, lat1], [lng2, lat2]) => {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

// A request's condition preference decides which donation conditions it
// will accept. Kept intentionally simple so it's easy to explain.
const isConditionCompatible = (requestCondition, donationCondition) => {
    if (requestCondition === "any") return true;
    if (requestCondition === "new") return donationCondition === "new";
    if (requestCondition === "like_new") {
        return donationCondition === "new" || donationCondition === "like_new";
    }
    // requestCondition === "used" accepts anything but nothing pickier
    // than "used" is required, so used/like_new/new all qualify.
    return true;
};

module.exports = { DEFAULT_MATCH_DISTANCE_KM, distanceKm, isConditionCompatible };
