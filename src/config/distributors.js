const DISTRIBUTOR_TIERS = {
  'dist-silver-01': 'silver',
  'dist-gold-01': 'gold',
  'dist-platinum-01': 'platinum',
  // Test / example distributors
  'dist-001': 'silver',
  'dist-002': 'gold',
  'dist-003': 'platinum',
};

function getDistributorTier(distributorId) {
  const { DEFAULT_DISTRIBUTOR_TIER } = require('./products');
  return DISTRIBUTOR_TIERS[distributorId] || DEFAULT_DISTRIBUTOR_TIER;
}

module.exports = {
  DISTRIBUTOR_TIERS,
  getDistributorTier,
};
