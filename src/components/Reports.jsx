import { useState } from 'react';
import { printA4Report } from '../utils/escpos';

export default function Reports({ transactions, products }) {
  const [dateFilter, setDateFilter] = useState('today');
  const [customDate, setCustomDate] = useState('');
  const [selectedTxn, setSelectedTxn] = useState(null);

  const today = new Date().toISOString().split('T')[0];

  const getDateRange = () => {
    const now = new Date();
    if (dateFilter === 'today') return [today, today];
    if (dateFilter === 'yesterday') {
      const y = new Date(now); y.setDate(y.getDate() - 1);
      const yd = y.toISOString().split('T')[0];
      return [yd, yd];
    }
    if (dateFilter === 'week') {
      const w = new Date(now); w.setDate(w.getDate() - 7);
      return [w.toISOString().split('T')[0], today];
    }
    if (dateFilter === 'month') {
      const m = new Date(now); m.setDate(1);
      return [m.toISOString().split('T')[0], today];
    }
    if (dateFilter === 'custom' && customDate) return [customDate, customDate];
    return [today, today];
  };

  const [from, to] = getDateRange();
  const filtered = transactions.filter(t => t.date >= from && t.date <= to);
  const totalSales = filtered.reduce((s, t) => s + t.subtotal, 0);
  const totalCash = filtered.reduce((s, t) => s + t.cash, 0);
  const totalChange = filtered.reduce((s, t) => s + t.change, 0);

  // Item breakdown
  const itemMap = {};
  filtered.forEach(t => {
    t.items.forEach(item => {
      if (!itemMap[item.productId]) itemMap[item.productId] = { name: item.name, qty: 0, amount: 0 };
      itemMap[item.productId].qty += item.qty;
      itemMap[item.productId].amount += item.total;
    });
  });
  const topItems = Object.values(itemMap).sort((a, b) => b.amount - a.amount);

  const handlePrintReport = () => {
    const rows = filtered.slice().reverse().map(t => `
      <tr>
        <td>${t.id}</td>
        <td>${t.date}</td>
        <td>${t.time}</td>
        <td>${t.cashierName}</td>
        <td>${t.items.length}</td>
        <td class="text-right">₱${t.subtotal.toLocaleString()}</td>
      </tr>
    `).join('');

    const itemRows = topItems.map(i => `
      <tr>
        <td>${i.name}</td>
        <td>${i.qty}</td>
        <td class="text-right">₱${i.amount.toLocaleString()}</td>
      </tr>
    `).join('');

    const html = `
      <h1>CARREN'S STORE — Sales Report</h1>
      <p>Period: <strong>${from}</strong> to <strong>${to}</strong> | Generated: ${new Date().toLocaleString()}</p>
      <div style="display:flex;gap:20px;margin-bottom:20px;flex-wrap:wrap;">
        <div class="summary-box"><div style="font-size:20pt;font-weight:bold;">₱${totalSales.toLocaleString()}</div><div>Total Sales</div></div>
        <div class="summary-box"><div style="font-size:20pt;font-weight:bold;">${filtered.length}</div><div>Transactions</div></div>
        <div class="summary-box"><div style="font-size:20pt;font-weight:bold;">${filtered.reduce((s,t)=>s+t.items.length,0)}</div><div>Items Sold</div></div>
      </div>
      <h2>Transaction History</h2>
      <table>
        <thead><tr><th>OR #</th><th>Date</th><th>Time</th><th>Cashier</th><th>Items</th><th>Amount</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td colspan="5"><strong>TOTAL</strong></td><td class="text-right"><strong>₱${totalSales.toLocaleString()}</strong></td></tr></tfoot>
      </table>
      <h2 style="margin-top:20px;">Product Sales Breakdown</h2>
      <table>
        <thead><tr><th>Product</th><th>Qty Sold</th><th>Amount</th></tr></thead>
        <tbody>${itemRows}</tbody>
      </table>
    `;
    printA4Report(html, 'Sales Report');
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
            { v: 'custom', l: 'Custom Date' },
          ].map(({ v, l }) => (
            <button
              key={v}
              className={`btn btn-sm ${dateFilter === v ? 'btn-dark' : 'btn-outline-secondary'}`}
              onClick={() => setDateFilter(v)}
            >
              {l}
            </button>
          ))}
          {dateFilter === 'custom' && (
            <input type="date" className="form-control form-control-sm" value={customDate} onChange={e => setCustomDate(e.target.value)} />
          )}
        </div>
        <button className="btn btn-outline-dark" onClick={handlePrintReport}>
          <i className="bi bi-printer me-2"></i>Print A4 Report
        </button>
      </div>

      {/* Summary Cards */}
      <div className="row g-3 mb-4">
        {[
          { label: 'Total Sales', value: `₱${totalSales.toLocaleString()}`, icon: 'bi-cash-stack', color: '#198754', bg: '#d1edda' },
          { label: 'Transactions', value: filtered.length, icon: 'bi-receipt', color: '#0d6efd', bg: '#cfe2ff' },
          { label: 'Items Sold', value: filtered.reduce((s, t) => s + t.items.length, 0), icon: 'bi-box-seam', color: '#6610f2', bg: '#e0cffc' },
          { label: 'Avg. Per Transaction', value: filtered.length ? `₱${(totalSales / filtered.length).toFixed(2)}` : '₱0', icon: 'bi-graph-up', color: '#fd7e14', bg: '#ffe5d0' },
        ].map(card => (
          <div className="col-6 col-lg-3" key={card.label}>
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

      <div className="row g-3">
        {/* Transaction list */}
        <div className="col-lg-8">
          <div className="card card-custom">
            <div className="card-header-custom">
              <i className="bi bi-list-ul me-2"></i>Transaction History
              <span className="ms-2 badge bg-secondary">{filtered.length}</span>
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
                  {filtered.slice().reverse().map(txn => (
                    <tr key={txn.id}>
                      <td><code className="small">{txn.id}</code></td>
                      <td>{txn.date} <span className="text-muted">{txn.time}</span></td>
                      <td>{txn.cashierName}</td>
                      <td className="text-center">{txn.items.length}</td>
                      <td className="text-end fw-semibold text-success">₱{txn.subtotal.toLocaleString()}</td>
                      <td className="text-center">
                        <button className="btn btn-outline-secondary btn-sm" onClick={() => setSelectedTxn(txn)}>
                          <i className="bi bi-eye"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan="6" className="text-center text-muted py-4">No transactions for this period</td></tr>
                  )}
                </tbody>
                {filtered.length > 0 && (
                  <tfoot className="table-light">
                    <tr>
                      <td colSpan="4" className="fw-bold">Total</td>
                      <td className="text-end fw-bold text-success">₱{totalSales.toLocaleString()}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>

        {/* Item breakdown */}
        <div className="col-lg-4">
          <div className="card card-custom">
            <div className="card-header-custom">
              <i className="bi bi-bar-chart me-2"></i>Product Sales Breakdown
            </div>
            <div className="card-body p-0">
              {topItems.length === 0 ? (
                <div className="empty-state py-4"><i className="bi bi-inbox fs-2 text-muted"></i><p className="text-muted small mt-2">No data</p></div>
              ) : (
                <ul className="list-group list-group-flush">
                  {topItems.map((item, i) => {
                    const pct = topItems[0].amount > 0 ? (item.amount / topItems[0].amount) * 100 : 0;
                    return (
                      <li key={item.name} className="list-group-item py-2">
                        <div className="d-flex justify-content-between mb-1">
                          <span className="small fw-semibold">#{i + 1} {item.name}</span>
                          <span className="small text-success">₱{item.amount.toLocaleString()}</span>
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
                        <tr key={item.productId}>
                          <td>{item.name}</td>
                          <td className="text-center">{item.qty}x</td>
                          <td className="text-end">₱{item.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <hr className="receipt-dashed" />
                  <div className="d-flex justify-content-between fw-bold"><span>TOTAL</span><span>₱{selectedTxn.subtotal}</span></div>
                  <div className="d-flex justify-content-between small text-muted"><span>CASH</span><span>₱{selectedTxn.cash}</span></div>
                  <div className="d-flex justify-content-between small text-success"><span>CHANGE</span><span>₱{selectedTxn.change}</span></div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline-secondary btn-sm" onClick={() => setSelectedTxn(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
