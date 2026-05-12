import { useMemo } from 'react';

/**
 * Compute report aggregates for the selected date range.
 */
export function useReportsData({ transactions, products, expenses, fromDate, toDate }) {
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => t.date >= fromDate && t.date <= toDate);
  }, [transactions, fromDate, toDate]);

  const filteredExpenses = useMemo(() => {
    return (expenses || []).filter(e => e.date >= fromDate && e.date <= toDate);
  }, [expenses, fromDate, toDate]);

  const productCostMap = useMemo(
    () => new Map(products.map(p => [p.id, Number(p.cost || 0)])),
    [products]
  );

  const totals = useMemo(() => {
    let totalSales = 0;
    let totalCost = 0;
    let totalItems = 0;

    filteredTransactions.forEach(txn => {
      totalSales += Number(txn.subtotal || 0);
      totalItems += txn.items.length;
      txn.items.forEach(item => {
        const currentCost = productCostMap.get(item.productId);
        const unitCost = Number.isFinite(currentCost) && currentCost > 0
          ? currentCost
          : Number(item.cost || 0);
        totalCost += unitCost * Number(item.qty || 0);
      });
    });

    return { totalSales, totalCost, totalItems };
  }, [filteredTransactions, productCostMap]);

  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const margin = totals.totalSales - totals.totalCost;
  const totalProfit = margin - totalExpenses;

  const dayCount = Math.max(1, Math.floor((new Date(toDate) - new Date(fromDate)) / 86400000) + 1);
  const dailySales = totals.totalSales / dayCount;

  const inventoryInsights = useMemo(() => {
    const inventoryPrice = products.reduce((sum, p) => sum + Number(p.price || 0) * Number(p.stock || 0), 0);
    const inventoryCost = products.reduce((sum, p) => sum + Number(p.cost || 0) * Number(p.stock || 0), 0);
    return {
      inventoryPrice,
      inventoryCost,
      potentialMargin: inventoryPrice - inventoryCost,
    };
  }, [products]);

  const topSellingByAmount = useMemo(() => {
    const itemMap = {};
    filteredTransactions.forEach(t => {
      t.items.forEach(item => {
        const key = item.productId || item.name;
        if (!itemMap[key]) itemMap[key] = { name: item.name, qty: 0, amount: 0 };
        itemMap[key].qty += item.qty;
        itemMap[key].amount += item.total;
      });
    });
    return Object.values(itemMap).sort((a, b) => b.amount - a.amount);
  }, [filteredTransactions]);

  const topMovingByQty = useMemo(() => {
    const itemMap = {};
    filteredTransactions.forEach(t => {
      t.items.forEach(item => {
        const key = item.productId || item.name;
        if (!itemMap[key]) itemMap[key] = { name: item.name, qty: 0, amount: 0 };
        itemMap[key].qty += item.qty;
        itemMap[key].amount += item.total;
      });
    });
    return Object.values(itemMap).sort((a, b) => b.qty - a.qty);
  }, [filteredTransactions]);

  return {
    filteredTransactions,
    filteredExpenses,
    totals,
    totalExpenses,
    margin,
    totalProfit,
    dayCount,
    dailySales,
    inventoryInsights,
    topSellingByAmount,
    topMovingByQty,
    productCostMap,
  };
}
