// Extend this map or swap for a live API call (e.g. Open Exchange Rates)
export const RATE_TABLE: Partial<Record<string, string>> = {
  // USD pairs
  'USD:EUR': '0.9200',
  'USD:GBP': '0.7900',
  'USD:NGN': '1550.00',
  'USD:JPY': '157.50',
  'USD:AUD': '1.5300',
  'USD:CAD': '1.3650',
  'USD:CNY': '7.2400',

  // EUR pairs
  'EUR:USD': '1.0870',
  'EUR:GBP': '0.8580',
  'EUR:NGN': '1683.15',
  'EUR:JPY': '171.05',
  'EUR:AUD': '1.6620',
  'EUR:CAD': '1.4830',
  'EUR:CNY': '7.8650',

  // GBP pairs
  'GBP:USD': '1.2658',
  'GBP:EUR': '1.1655',
  'GBP:NGN': '1962.00',
  'GBP:JPY': '199.35',
  'GBP:AUD': '1.9370',
  'GBP:CAD': '1.7280',
  'GBP:CNY': '9.1670',

  // NGN pairs
  'NGN:USD': '0.000645',
  'NGN:EUR': '0.000594',
  'NGN:GBP': '0.000510',
  'NGN:JPY': '0.1016',
  'NGN:AUD': '0.000987',
  'NGN:CAD': '0.000881',
  'NGN:CNY': '0.004671',

  // JPY pairs
  'JPY:USD': '0.006349',
  'JPY:EUR': '0.005847',
  'JPY:GBP': '0.005016',
  'JPY:NGN': '9.8413',
  'JPY:AUD': '0.009714',
  'JPY:CAD': '0.008667',
  'JPY:CNY': '0.045968',

  // AUD pairs
  'AUD:USD': '0.6536',
  'AUD:EUR': '0.6017',
  'AUD:GBP': '0.5163',
  'AUD:NGN': '1013.07',
  'AUD:JPY': '102.94',
  'AUD:CAD': '0.8922',
  'AUD:CNY': '4.7320',

  // CAD pairs
  'CAD:USD': '0.7326',
  'CAD:EUR': '0.6745',
  'CAD:GBP': '0.5787',
  'CAD:NGN': '1135.53',
  'CAD:JPY': '115.39',
  'CAD:AUD': '1.1208',
  'CAD:CNY': '5.3040',

  // CNY pairs
  'CNY:USD': '0.1381',
  'CNY:EUR': '0.1272',
  'CNY:GBP': '0.1091',
  'CNY:NGN': '214.09',
  'CNY:JPY': '21.7560',
  'CNY:AUD': '0.2114',
  'CNY:CAD': '0.1885',
};
