import Decimal from "decimal.js";

export const paise = (value: string | number): number => {
  const result = new Decimal(value).mul(100);
  if (!result.isInteger()) throw new Error(`Not an INR-paise value: ${value}`);
  return result.toNumber();
};

export const inr = (value: number): string =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" })
    .format(value / 100);
