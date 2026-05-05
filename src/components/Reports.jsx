import { useMemo, useState } from 'react';
import { printA4Report } from '../utils/escpos';
import { toLocalDateString } from '../utils/date';

const peso = (value) => `₱${Number(value || 0).toLocaleString()}`;

export default function Reports({ transactions, products, expenses, currentUser, onCreateExpense }) {
  const today = toLocalDateString();
  const [rangePreset, setRangePreset] = useState('today');
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ date: today, amount: '', category: '', note: '' });
  const [expenseSaving, setExpenseSaving] = useState(false);
  const [expenseError, setExpenseError] = useState('');

  const canManage = currentUser?.role === 'superadmin' || currentUser?.role === 'admin';

  const applyPreset = (preset) => {
    const now = new Date();
    let start = today;
    let end = today;

    if (preset === 'yesterday') {
      const y = new Date(now); y.setDate(y.getDate() - 1);
      start = toLocalDateString(y);
      end = start;
    } else if (preset === 'week') {
      const w = new Date(now); w.setDate(w.getDate() - 7);
      start = toLocalDateString(w);
    } else if (preset === 'month') {
      const m = new Date(now); m.setDate(1);
      start = toLocalDateString(m);
    }

    setRangePreset(preset);
    setFromDate(start);
    setToDate(end);
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => t.date >= fromDate && t.date <= toDate);
  }, [transactions, fromDate, toDate]);

  const filteredExpenses = useMemo(() => {
    return (expenses || []).filter(e => e.date >= fromDate && e.date <= toDate);
  }, [expenses, fromDate, toDate]);

  const productCostMap = useMemo(() => new Map(products.map(p => [p.id, Number(p.cost || 0)])), [products]);

  const totals = useMemo(() => {
    let totalSales = 0;
    let totalCost = 0;
    let totalItems = 0;

    filteredTransactions.forEach(txn => {
      totalSales += Number(txn.subtotal || 0);
      totalItems += txn.items.length;
      txn.items.forEach(item => {
        const costTotal = Number(item.costTotal || 0);
        if (costTotal) {
          totalCost += costTotal;
        } else {
          const fallbackCost = Number(item.cost || 0) || productCostMap.get(item.productId) || 0;
          totalCost += fallbackCost * Number(item.qty || 0);
        }
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

  const handlePrintReport = () => {
    const rows = filteredTransactions.slice().reverse().map(t => `
      <tr>
        <td>${t.id}</td>
        <td>${t.date}</td>
        <td>${t.time}</td>
        <td>${t.cashierName}</td>
        <td>${t.items.length}</td>
        <td class="text-right">${peso(t.subtotal)}</td>
      </tr>
    `).join('');

    const itemRows = topSellingByAmount.map(i => `
      <tr>
        <td>${i.name}</td>
        <td>${i.qty}</td>
        <td class="text-right">${peso(i.amount)}</td>
      </tr>
    `).join('');

    const expenseRows = filteredExpenses.map(e => `
      <tr>
        <td>${e.date}</td>
        <td>${e.category}</td>
        <td>${e.note || ''}</td>
        <td class="text-right">${peso(e.amount)}</td>
      </tr>
    `).join('');

    const html = `
      <h1>CARREN'S STORE — Sales Report</h1>
      <p>Period: <strong>${fromDate}</strong> to <strong>${toDate}</strong> | Generated: ${new Date().toLocaleString()}</p>
      <div style="display:flex;gap:20px;margin-bottom:20px;flex-wrap:wrap;">
        <div class="summary-box"><div style="font-size:20pt;font-weight:bold;">${peso(dailySales)}</div><div>Daily Sales</div></div>
        <div class="summary-box"><div style="font-size:20pt;font-weight:bold;">${peso(totals.totalSales)}</div><div>Total Sales</div></div>
        <div class="summary-box"><div style="font-size:20pt;font-weight:bold;">${peso(totals.totalCost)}</div><div>Cost of Goods Sold</div></div>
        <div class="summary-box"><div style="font-size:20pt;font-weight:bold;">${peso(margin)}</div><div>Margin</div></div>
        <div class="summary-box"><div style="font-size:20pt;font-weight:bold;">${peso(totalExpenses)}</div><div>Expenses</div></div>
        <div class="summary-box"><div style="font-size:20pt;font-weight:bold;">${peso(totalProfit)}</div><div>Total Profit</div></div>
      </div>
      <h2>Transaction History</h2>
      <table>
        <thead><tr><th>OR #</th><th>Date</th><th>Time</th><th>Cashier</th><th>Items</th><th>Amount</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td colspan="5"><strong>TOTAL</strong></td><td class="text-right"><strong>${peso(totals.totalSales)}</strong></td></tr></tfoot>
      </table>
      <h2 style="margin-top:20px;">Product Sales Breakdown</h2>
      <table>
        <thead><tr><th>Product</th><th>Qty Sold</th><th>Amount</th></tr></thead>
        <tbody>${itemRows}</tbody>
      </table>
      <h2 style="margin-top:20px;">Expenses</h2>
      <table>
        <thead><tr><th>Date</th><th>Category</th><th>Note</th><th>Amount</th></tr></thead>
        <tbody>${expenseRows || '<tr><td colspan="4">No expenses</td></tr>'}</tbody>
      </table>
    `;
    printA4Report(html, 'Sales Report');
  };

  const handleExportCsv = () => {
    const rows = [
      ['Transaction ID', 'Date', 'Time', 'Cashier', 'Product', 'Qty', 'Price', 'Total', 'Cost', 'Cost Total'],
    ];

    filteredTransactions.forEach(txn => {
      txn.items.forEach(item => {
        const cost = Number(item.cost || 0);
        const costTotal = Number(item.costTotal || (cost * Number(item.qty || 0)));
        rows.push([
          txn.id,
          txn.date,
          txn.time,
          txn.cashierName,
          item.name,
          item.qty,
          item.price,
          item.total,
          cost,
          costTotal,
        ]);
      });
    });

    const csv = rows.map(r => r.map(value => {
      const text = String(value ?? '');
      if (text.includes(',') || text.includes('"') || text.includes('\n')) {
        return '"' + text.replace(/"/g, '""') + '"';
      }
      return text;
    }).join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pos-report-${fromDate}-to-${toDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleAddExpense = async () => {
    if (!expenseForm.date || !expenseForm.category || !expenseForm.amount) return;

    setExpenseSaving(true);
    setExpenseError('');
    try {
      await onCreateExpense({
        date: expenseForm.date,
        amount: expenseForm.amount,
        category: expenseForm.category,
        note: expenseForm.note,
      });
      setExpenseForm({ date: today, amount: '', category: '', note: '' });
      setShowExpenseModal(false);
    } catch (err) {
      setExpenseError(err.message || 'Failed to add expense.');
    } finally {
      setExpenseSaving(false);
    }
  };

  return (
    <div>
      {/* Filters */}
      <div className="d-flex flex-wrap gap-2 mb-4 align-items-center justify-content-between">
        <div className="d-flex gap-2 flex-wrap">
          {[
            { v: 'today', l: 'Today' },
            { v: 'yesterday', l: 'Yesterday' },
            { v: 'week', l: 'Last 7 Days' },
            { v: 'month', l: 'This Month' },
          ].map(({ v, l }) => (
            <button
              key={v}
              className={`btn btn-sm ${rangePreset === v ? 'btn-dark' : 'btn-outline-secondary'}`}
              onClick={() => applyPreset(v)}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="d-flex gap-2 flex-wrap align-items-center">
          <div className="d-flex align-items-center gap-2">
            <label className="small text-muted">From</label>
            <input
              type="date"
              className="form-control form-control-sm"
              value={fromDate}
              onChange={e => { setFromDate(e.target.value); setRangePreset('custom'); }}
            />
          </div>
          <div className="d-flex align-items-center gap-2">
            <label className="small text-muted">To</label>
            <input
              type="date"
              className="form-control form-control-sm"
              value={toDate}
              onChange={e => { setToDate(e.target.value); setRangePreset('custom'); }}
            />
          </div>
          <button className="btn btn-outline-dark" onClick={handlePrintReport}>
            <i className="bi bi-printer me-2"></i>Print A4 Report
          </button>
          <button className="btn btn-outline-secondary" onClick={handleExportCsv}>
            <i className="bi bi-download me-2"></i>Export CSV
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="row g-3 mb-4">
        {[
          { label: dayCount > 1 ? 'Daily Sales (Avg)' : 'Daily Sales', value: peso(dailySales), icon: 'bi-cash-coin', color: '#198754', bg: '#d1edda' },
          { label: 'Total Sales', value: peso(totals.totalSales), icon: 'bi-cash-stack', color: '#0d6efd', bg: '#cfe2ff' },
          { label: 'Cost of Products Sold', value: peso(totals.totalCost), icon: 'bi-box', color: '#6c757d', bg: '#e2e3e5' },
          { label: 'Margin', value: peso(margin), icon: 'bi-graph-up-arrow', color: '#6610f2', bg: '#e0cffc' },
          { label: 'Expenses', value: peso(totalExpenses), icon: 'bi-receipt-cutoff', color: '#dc3545', bg: '#f8d7da' },
          { label: 'Total Profit', value: peso(totalProfit), icon: 'bi-piggy-bank', color: '#fd7e14', bg: '#ffe5d0' },
        ].map(card => (
          <div className="col-6 col-lg-4" key={card.label}>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: card.bg, color: card.color }}>
                <i className={`bi ${card.icon}`}></i>
              </div>
              <div className="stat-value">{card.value}</div>
              <div className="stat-label">{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Stock Insights */}
      <div className="card card-custom mb-4">
        <div className="card-header-custom">
          <i className="bi bi-box-seam me-2"></i>Stock Insights
        </div>
        <div className="card-body">
          <div className="row g-3">
            <div className="col-6 col-lg-4">
              <div className="stat-card">
                <div className="stat-icon" style={{ background: '#e2f0ff', color: '#0d6efd' }}>
                  <i className="bi bi-basket"></i>
                </div>
                <div className="stat-value">{peso(inventoryInsights.inventoryPrice)}</div>
                <div className="stat-label">Inventory Price</div>
              </div>
            </div>
            <div className="col-6 col-lg-4">
              <div className="stat-card">
                <div className="stat-icon" style={{ background: '#f2f2f2', color: '#6c757d' }}>
                  <i className="bi bi-wallet2"></i>
                </div>
                <div className="stat-value">{peso(inventoryInsights.inventoryCost)}</div>
                <div className="stat-label">Inventory Cost</div>
              </div>
            </div>
            <div className="col-6 col-lg-4">
              <div className="stat-card">
                <div className="stat-icon" style={{ background: '#e0cffc', color: '#6610f2' }}>
                  <i className="bi bi-stars"></i>
                </div>
                <div className="stat-value">{peso(inventoryInsights.potentialMargin)}</div>
                <div className="stat-label">Potential Sales Margin</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3">
        {/* Transaction list */}
        <div className="col-lg-8">
          <div className="card card-custom">
            <div className="card-header-custom">
              <i className="bi bi-list-ul me-2"></i>Transaction History
              <span className="ms-2 badge bg-secondary">{filteredTransactions.length}</span>
            </div>
            <div className="table-responsive">
              <table className="table table-hover mb-0 align-middle small">
                <thead className="table-light">
                  <tr>
                    <th>OR #</th>
                    <th>Date / Time</th>
                    <th>Cashier</th>
                    <th className="text-center">Items</th>
                    <th className="text-end">Amount</th>
                    <th className="text-center">View</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.slice().reverse().map(txn => (
                    <tr key={txn.id}>
                      <td><code className="small">{txn.id}</code></td>
                      <td>{txn.date} <span className="text-muted">{txn.time}</span></td>
                      <td>{txn.cashierName}</td>
                      <td className="text-center">{txn.items.length}</td>
                      <td className="text-end fw-semibold text-success">{peso(txn.subtotal)}</td>
                      <td className="text-center">
                        <button className="btn btn-outline-secondary btn-sm" onClick={() => setSelectedTxn(txn)}>
                          <i className="bi bi-eye"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredTransactions.length === 0 && (
                    <tr><td colSpan="6" className="text-center text-muted py-4">No transactions for this period</td></tr>
                  )}
                </tbody>
                {filteredTransactions.length > 0 && (
                  <tfoot className="table-light">
                    <tr>
                      <td colSpan="4" className="fw-bold">Total</td>
                      <td className="text-end fw-bold text-success">{peso(totals.totalSales)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>

        {/* Top selling by amount */}
        <div className="col-lg-4">
          <div className="card card-custom mb-3">
            <div className="card-header-custom">
              <i className="bi bi-bar-chart me-2"></i>Product Sales Breakdown
            </div>
            <div className="card-body p-0">
              {topSellingByAmount.length === 0 ? (
                <div className="empty-state py-4"><i className="bi bi-inbox fs-2 text-muted"></i><p className="text-muted small mt-2">No data</p></div>
              ) : (
                <ul className="list-group list-group-flush">
                  {topSellingByAmount.map((item, i) => {
                    const pct = topSellingByAmount[0].amount > 0 ? (item.amount / topSellingByAmount[0].amount) * 100 : 0;
                    return (
                      <li key={item.name} className="list-group-item py-2">
                        <div className="d-flex justify-content-between mb-1">
                          <span className="small fw-semibold">#{i + 1} {item.name}</span>
                          <span className="small text-success">{peso(item.amount)}</span>
                        </div>
                        <div className="d-flex align-items-center gap-2">
                          <div className="progress flex-grow-1" style={{ height: 5 }}>
                            <div className="progress-bar bg-secondary" style={{ width: `${pct}%` }}></div>
                          </div>
                          <span className="text-muted small">{item.qty}x</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Top moving by qty */}
          <div className="card card-custom">
            <div className="card-header-custom">
              <i className="bi bi-activity me-2"></i>Top Moving Products
            </div>
            <div className="card-body p-0">
              {topMovingByQty.length === 0 ? (
                <div className="empty-state py-4"><i className="bi bi-inbox fs-2 text-muted"></i><p className="text-muted small mt-2">No data</p></div>
              ) : (
                <ul className="list-group list-group-flush">
                  {topMovingByQty.slice(0, 8).map((item, i) => (
                    <li key={item.name} className="list-group-item py-2 d-flex align-items-center justify-content-between">
                      <span className="small fw-semibold">#{i + 1} {item.name}</span>
                      <span className="badge bg-light text-dark border">{item.qty} pcs</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Expenses */}
      <div className="card card-custom mt-4">
        <div className="card-header-custom d-flex justify-content-between align-items-center">
          <div><i className="bi bi-receipt-cutoff me-2"></i>Expenses</div>
          {canManage && (
            <button className="btn btn-sm btn-outline-dark" onClick={() => setShowExpenseModal(true)}>
              <i className="bi bi-plus-circle me-1"></i>Add Expense
            </button>
          )}
        </div>
        <div className="table-responsive">
          <table className="table table-hover mb-0 align-middle small">
            <thead className="table-light">
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Note</th>
                <th className="text-end">Amount</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.map(exp => (
                <tr key={exp.id}>
                  <td>{exp.date}</td>
                  <td>{exp.category}</td>
                  <td className="text-muted">{exp.note || '-'}</td>
                  <td className="text-end">{peso(exp.amount)}</td>
                </tr>
              ))}
              {filteredExpenses.length === 0 && (
                <tr><td colSpan="4" className="text-center text-muted py-4">No expenses for this period</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction Detail Modal */}
      {selectedTxn && (
        <div className="modal fade show d-block" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered modal-sm">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title small"><i className="bi bi-receipt me-2"></i>{selectedTxn.id}</h5>
                <button className="btn-close" onClick={() => setSelectedTxn(null)}></button>
              </div>
              <div className="modal-body">
                <div className="receipt-preview">
                  <div className="receipt-info small mb-2">
                    <div className="d-flex justify-content-between"><span>Date:</span><span>{selectedTxn.date}</span></div>
                    <div className="d-flex justify-content-between"><span>Time:</span><span>{selectedTxn.time}</span></div>
                    <div className="d-flex justify-content-between"><span>Cashier:</span><span>{selectedTxn.cashierName}</span></div>
                  </div>
                  <hr className="receipt-dashed" />
                  <table className="w-100 small">
                    <tbody>
                      {selectedTxn.items.map(item => (
                        <tr key={item.productId || item.name}>
                          <td>{item.name}</td>
                          <td className="text-center">{item.qty}x</td>
                          <td className="text-end">{peso(item.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <hr className="receipt-dashed" />
                  <div className="d-flex justify-content-between fw-bold"><span>TOTAL</span><span>{peso(selectedTxn.subtotal)}</span></div>
                  <div className="d-flex justify-content-between small text-muted"><span>CASH</span><span>{peso(selectedTxn.cash)}</span></div>
                  <div className="d-flex justify-content-between small text-success"><span>CHANGE</span><span>{peso(selectedTxn.change)}</span></div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline-secondary btn-sm" onClick={() => setSelectedTxn(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Expense Modal */}
      {showExpenseModal && (
        <div className="modal fade show d-block" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title"><i className="bi bi-plus-circle me-2"></i>Add Expense</h5>
                <button className="btn-close" onClick={() => setShowExpenseModal(false)}></button>
              </div>
              <div className="modal-body">
                {expenseError && (
                  <div className="alert alert-danger py-2 small">
                    <i className="bi bi-exclamation-circle me-1"></i>{expenseError}
                  </div>
                )}
                <div className="row g-3">
                  <div className="col-6">
                    <label className="form-label fw-semibold">Date *</label>
                    <input type="date" className="form-control" value={expenseForm.date} onChange={e => setExpenseForm({ ...expenseForm, date: e.target.value })} />
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold">Amount (₱) *</label>
                    <input type="number" className="form-control" value={expenseForm.amount} onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })} min="0" step="0.01" />
                  </div>
                  <div className="col-12">
                    <label className="form-label fw-semibold">Category *</label>
                    <input className="form-control" value={expenseForm.category} onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value })} placeholder="e.g. Rent, Utilities" />
                  </div>
                  <div className="col-12">
                    <label className="form-label fw-semibold">Note</label>
                    <input className="form-control" value={expenseForm.note} onChange={e => setExpenseForm({ ...expenseForm, note: e.target.value })} placeholder="Optional notes" />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline-secondary" onClick={() => setShowExpenseModal(false)}>Cancel</button>
                <button className="btn btn-dark" onClick={handleAddExpense} disabled={expenseSaving || !expenseForm.date || !expenseForm.amount || !expenseForm.category}>
                  {expenseSaving
                    ? <><span className="spinner-border spinner-border-sm me-2"></span>Saving...</>
                    : <><i className="bi bi-check2 me-2"></i>Save Expense</>
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
