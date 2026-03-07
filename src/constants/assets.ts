import type { AssetCategory } from '@/types/thesis';

export interface AssetCategoryConfig {
  key: AssetCategory;
  label: string;
  icon: string; // emoji
  assets: AssetItem[];
}

export interface AssetItem {
  symbol: string;
  name: string;
}

export const ASSET_CATEGORIES: AssetCategoryConfig[] = [
  {
    key: 'crypto',
    label: '加密货币',
    icon: '₿',
    assets: [
      { symbol: 'BTC', name: 'Bitcoin' },
      { symbol: 'ETH', name: 'Ethereum' },
      { symbol: 'SOL', name: 'Solana' },
      { symbol: 'BNB', name: 'BNB' },
      { symbol: 'XRP', name: 'Ripple' },
      { symbol: 'ADA', name: 'Cardano' },
      { symbol: 'AVAX', name: 'Avalanche' },
      { symbol: 'DOGE', name: 'Dogecoin' },
      { symbol: 'DOT', name: 'Polkadot' },
      { symbol: 'MATIC', name: 'Polygon' },
      { symbol: 'LINK', name: 'Chainlink' },
      { symbol: 'UNI', name: 'Uniswap' },
      { symbol: 'ARB', name: 'Arbitrum' },
      { symbol: 'OP', name: 'Optimism' },
    ],
  },
  {
    key: 'us-stock',
    label: '美股',
    icon: '🇺🇸',
    assets: [
      { symbol: 'AAPL', name: 'Apple' },
      { symbol: 'MSFT', name: 'Microsoft' },
      { symbol: 'GOOGL', name: 'Alphabet' },
      { symbol: 'AMZN', name: 'Amazon' },
      { symbol: 'NVDA', name: 'NVIDIA' },
      { symbol: 'META', name: 'Meta' },
      { symbol: 'TSLA', name: 'Tesla' },
      { symbol: 'AMD', name: 'AMD' },
      { symbol: 'NFLX', name: 'Netflix' },
      { symbol: 'CRM', name: 'Salesforce' },
      { symbol: 'SPY', name: 'S&P 500 ETF' },
      { symbol: 'QQQ', name: 'Nasdaq 100 ETF' },
    ],
  },
  {
    key: 'a-stock',
    label: 'A股',
    icon: '🇨🇳',
    assets: [
      { symbol: '600519', name: '贵州茅台' },
      { symbol: '000858', name: '五粮液' },
      { symbol: '601318', name: '中国平安' },
      { symbol: '600036', name: '招商银行' },
      { symbol: '000001', name: '平安银行' },
      { symbol: '002594', name: '比亚迪' },
      { symbol: '601012', name: '隆基绿能' },
      { symbol: '300750', name: '宁德时代' },
      { symbol: '510300', name: '沪深300 ETF' },
      { symbol: '510500', name: '中证500 ETF' },
    ],
  },
  {
    key: 'hk-stock',
    label: '港股',
    icon: '🇭🇰',
    assets: [
      { symbol: '0700', name: '腾讯控股' },
      { symbol: '9988', name: '阿里巴巴' },
      { symbol: '3690', name: '美团' },
      { symbol: '9888', name: '百度集团' },
      { symbol: '1810', name: '小米集团' },
      { symbol: '9618', name: '京东集团' },
      { symbol: '2318', name: '中国平安' },
      { symbol: '0005', name: '汇丰控股' },
    ],
  },
  {
    key: 'bond',
    label: '债券',
    icon: '📜',
    assets: [
      { symbol: 'US10Y', name: '美国10年期国债' },
      { symbol: 'US2Y', name: '美国2年期国债' },
      { symbol: 'TLT', name: '20年+美债 ETF' },
      { symbol: 'LQD', name: '投资级企业债 ETF' },
      { symbol: 'HYG', name: '高收益债 ETF' },
      { symbol: 'CN10Y', name: '中国10年期国债' },
    ],
  },
  {
    key: 'commodity',
    label: '大宗商品',
    icon: '🛢️',
    assets: [
      { symbol: 'GOLD', name: '黄金' },
      { symbol: 'SILVER', name: '白银' },
      { symbol: 'WTI', name: '原油 (WTI)' },
      { symbol: 'BRENT', name: '布伦特原油' },
      { symbol: 'NG', name: '天然气' },
      { symbol: 'COPPER', name: '铜' },
      { symbol: 'CORN', name: '玉米' },
      { symbol: 'SOYBEAN', name: '大豆' },
    ],
  },
];

/** 根据 category key 获取配置 */
export function getCategoryConfig(key: AssetCategory) {
  return ASSET_CATEGORIES.find((c) => c.key === key);
}

/** 根据 category + symbol 获取资产名 */
export function getAssetName(category: AssetCategory, symbol: string): string {
  const config = getCategoryConfig(category);
  const asset = config?.assets.find((a) => a.symbol === symbol);
  return asset ? `${asset.name} (${symbol})` : symbol;
}
