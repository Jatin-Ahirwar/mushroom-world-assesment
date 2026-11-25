const { DEFAULT_DISTRIBUTOR_TIER } = require('./products');

const DISTRIBUTOR_TIERS = {
  'dist-silver-01': 'silver',
  'dist-gold-01': 'gold',
  'dist-platinum-01': 'platinum',
  'dist-001': 'silver',
  'dist-002': 'gold',
  'dist-003': 'platinum',
};

function getDistributorTier(distributorId) {
  return DISTRIBUTOR_TIERS[distributorId] || DEFAULT_DISTRIBUTOR_TIER;
}

module.exports = {
  DISTRIBUTOR_TIERS,
  getDistributorTier,
};
