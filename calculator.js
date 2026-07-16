export function calculateSpread({ adrUsd, krxKrw, usdKrw, adrRatio = 0.1 }) {
  for (const [name, value] of Object.entries({ adrUsd, krxKrw, usdKrw, adrRatio })) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new TypeError(`${name} must be a positive number`);
    }
  }

  const fairValueUsd = (krxKrw * adrRatio) / usdKrw;
  const premiumPct = ((adrUsd / fairValueUsd) - 1) * 100;
  return {
    fairValueUsd,
    premiumPct,
    absoluteGapUsd: adrUsd - fairValueUsd
  };
}

export function calculatePerpSpread({
  adrMarkUsd,
  ordinaryMarkUsd,
  adrOracleUsd,
  ordinaryOracleUsd,
  adrPerOrdinaryShare = 10
}) {
  for (const [name, value] of Object.entries({
    adrMarkUsd,
    ordinaryMarkUsd,
    adrOracleUsd,
    ordinaryOracleUsd,
    adrPerOrdinaryShare
  })) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new TypeError(`${name} must be a positive number`);
    }
  }

  const fairValueUsd = ordinaryMarkUsd / adrPerOrdinaryShare;
  const oracleFairValueUsd = ordinaryOracleUsd / adrPerOrdinaryShare;
  return {
    fairValueUsd,
    premiumPct: ((adrMarkUsd / fairValueUsd) - 1) * 100,
    absoluteGapUsd: adrMarkUsd - fairValueUsd,
    oracleFairValueUsd,
    oraclePremiumPct: ((adrOracleUsd / oracleFairValueUsd) - 1) * 100,
    adrMarkOracleDeviationPct: ((adrMarkUsd / adrOracleUsd) - 1) * 100,
    ordinaryMarkOracleDeviationPct: ((ordinaryMarkUsd / ordinaryOracleUsd) - 1) * 100
  };
}

export function quoteAgeMinutes(timestampSeconds, nowMs = Date.now()) {
  if (!Number.isFinite(timestampSeconds)) return null;
  return Math.max(0, (nowMs - timestampSeconds * 1000) / 60_000);
}
