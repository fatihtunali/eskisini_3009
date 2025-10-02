// Unit test example: Testing a pure function
// tests/unit/formatPrice.test.js

describe('formatPrice utility', () => {
  // Sample implementation of formatPrice function (would be imported from utils)
  function formatPrice(minor, currency = 'TRY') {
    const value = minor / 100;
    const symbol = currency === 'TRY' ? '₺' : currency;
    return `${value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${symbol}`;
  }

  describe('Turkish Lira (TRY)', () => {
    test('formats 10000 minor as 100,00 ₺', () => {
      expect(formatPrice(10000, 'TRY')).toBe('100,00 ₺');
    });

    test('formats 12345 minor as 123,45 ₺', () => {
      expect(formatPrice(12345, 'TRY')).toBe('123,45 ₺');
    });

    test('formats 0 as 0,00 ₺', () => {
      expect(formatPrice(0, 'TRY')).toBe('0,00 ₺');
    });

    test('formats large amounts correctly', () => {
      expect(formatPrice(1234567, 'TRY')).toBe('12.345,67 ₺');
    });
  });

  describe('Other currencies', () => {
    test('formats USD', () => {
      expect(formatPrice(10000, 'USD')).toBe('100,00 USD');
    });

    test('formats EUR', () => {
      expect(formatPrice(5000, 'EUR')).toBe('50,00 EUR');
    });
  });

  describe('Edge cases', () => {
    test('handles negative values', () => {
      expect(formatPrice(-10000, 'TRY')).toBe('-100,00 ₺');
    });

    test('uses TRY as default currency', () => {
      expect(formatPrice(10000)).toBe('100,00 ₺');
    });
  });
});