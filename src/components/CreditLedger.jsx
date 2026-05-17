import { useState, useMemo } from 'react';

const fmt = (n) => `₱${Number(n || 0).toFixed(2)}`;

const STATUS_BADGE = {
  unpaid:  { cls: 'bg-danger',   label: 'Unpaid' },
  partial: { cls: 'bg-warning text-dark', label: 'Partial' },
  paid:    { cls: 'bg-success',  label: 'Paid' },
};

function isOverdue(credit) {
  if (!credit.dueDate || credit.status === 'paid') return false;
  const due = new Date(credit.dueDate);
  due.setHours(23, 59, 59, 999);
  return due < new Date();
}

// ── Credit Card ────────────────────────────────────────────────────────────────
function CreditCard({ credit, onAddPayment, onEditDueDate, onViewItems, currentUser }) {
  const overdue = isOverdue(credit);
  const badge = STATUS_BADGE[credit.status] || STATUS_BADGE.unpaid;
  const canEdit = currentUser?.role === 'superadmin' || currentUser?.role === 'admin';

  return (
    <div className={`card card-custom mb-3 ${overdue ? 'border-danger' : ''}`}>
      <div className="card-header card-header-custom d-flex justify-content-between align-items-start">
        <div>
          <strong>{credit.customerName || '—'}</strong>
          {credit.customerContact && (
            <span className="ms-2 text-muted small">{credit.customerContact}</span>
          )}
          <div className="text-muted small">{credit.customerAddress}</div>
        </div>
        <div className="d-flex gap-2 align-items-center flex-wrap">
          {overdue && (
            <span className="badge bg-danger">
              <i className="bi bi-exclamation-triangle me-1" />Overdue
            </span>
          )}
          <span className={`badge ${badge.cls}`}>{badge.label}</span>
        </div>
      </div>

      <div className="card-body">
        {/* Financial summary */}
        <div className="row g-2 mb-3">
          <div className="col-4 text-center">
            <div className="text-muted small">Total</div>
            <div className="fw-bold">{fmt(credit.totalAmount)}</div>
          </div>
          <div className="col-4 text-center">
            <div className="text-muted small">Paid</div>
            <div className="fw-bold text-success">{fmt(credit.amountPaid)}</div>
          </div>
          <div className="col-4 text-center">
            <div className="text-muted small">Balance</div>
            <div className={`fw-bold ${credit.remainingBalance > 0 ? 'text-danger' : 'text-success'}`}>
              {fmt(credit.remainingBalance)}
            </div>
          </div>
        </div>

        {/* Dates */}
        <div className="d-flex gap-3 mb-3 small text-muted flex-wrap">
          {credit.startDate && (
            <span><i className="bi bi-calendar me-1" />Start: {credit.startDate}</span>
          )}
          {credit.dueDate && (
            <span className={overdue ? 'text-danger fw-semibold' : ''}>
              <i className="bi bi-calendar-x me-1" />Due: {credit.dueDate}
            </span>
          )}
          <span><i className="bi bi-person me-1" />Cashier: {credit.cashierName || '—'}</span>
        </div>

        {/* Payment history */}
        {credit.payments?.length > 0 && (
          <div className="mb-3">
            <div className="small fw-semibold text-muted mb-1">Payment History</div>
            <div className="border rounded p-2" style={{ maxHeight: 120, overflowY: 'auto' }}>
              {credit.payments.map((p, i) => (
                <div key={i} className="d-flex justify-content-between small border-bottom py-1">
                  <span>{p.date}{p.note ? ` — ${p.note}` : ''}</span>
                  <span className="text-success fw-semibold">{fmt(p.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="d-flex gap-2 flex-wrap">
          <button
            className="btn btn-sm btn-outline-secondary"
            onClick={() => onViewItems(credit)}
          >
            <i className="bi bi-list-ul me-1" />Items ({credit.items?.length || 0})
          </button>

          {credit.status !== 'paid' && canEdit && (
            <button
              className="btn btn-sm btn-process"
              onClick={() => onAddPayment(credit)}
            >
              <i className="bi bi-cash-coin me-1" />Add Payment
            </button>
          )}

          {canEdit && (
            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={() => onEditDueDate(credit)}
            >
              <i className="bi bi-calendar-event me-1" />Edit Due Date
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function CreditLedger({
  credits,
  transactions,
  currentUser,
  onAddCreditPayment,
  onUpdateCreditDueDate,
}) {
  const [activeTab, setActiveTab] = useState('credit');

  // Credit tab filters
  const [statusFilter, setStatusFilter] = useState('active');
  const [search, setSearch] = useState('');

  // Payment modal
  const [paymentTarget, setPaymentTarget] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  // Due date modal
  const [dueDateTarget, setDueDateTarget] = useState(null);
  const [newDueDate, setNewDueDate] = useState('');
  const [isDueSaving, setIsDueSaving] = useState(false);

  // Items modal
  const [itemsTarget, setItemsTarget] = useState(null);

  // ── Filtering ───────────────────────────────────────────────────────────────
  const filteredCredits = useMemo(() => {
    let list = credits || [];

    if (statusFilter === 'active') {
      list = list.filter(c => c.status !== 'paid');
    } else if (statusFilter === 'unpaid') {
      list = list.filter(c => c.status === 'unpaid');
    } else if (statusFilter === 'partial') {
      list = list.filter(c => c.status === 'partial');
    } else if (statusFilter === 'overdue') {
      list = list.filter(c => isOverdue(c));
    } else if (statusFilter === 'paid') {
      list = list.filter(c => c.status === 'paid');
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(c =>
        (c.customerName || '').toLowerCase().includes(q) ||
        (c.customerContact || '').toLowerCase().includes(q) ||
        (c.orNumber || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [credits, statusFilter, search]);

  // ── Stats ───────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const all = credits || [];
    return {
      totalCredit: all.reduce((s, c) => s + (c.totalAmount || 0), 0),
      totalOutstanding: all.filter(c => c.status !== 'paid').reduce((s, c) => s + (c.remainingBalance || 0), 0),
      overdueCount: all.filter(c => isOverdue(c)).length,
      unpaidCount: all.filter(c => c.status !== 'paid').length,
    };
  }, [credits]);

  // ── Cash Ledger list ────────────────────────────────────────────────────────
  const cashLedgerRows = useMemo(() => {
    const cashTxns = (transactions || [])
      .filter(t => ['cash', 'gcash', 'bank'].includes(t.paymentMethod))
      .map(t => ({
        id: t.id,
        date: t.date,
        customerName: t.customer?.name || '—',
        orNumber: t.orNumber || t.id,
        paymentMethod: t.paymentMethod,
        amount: t.subtotal || 0,
        type: 'transaction',
      }));

    const paidCredits = (credits || [])
      .filter(c => c.status === 'paid')
      .map(c => ({
        id: c.id,
        date: c.startDate,
        customerName: c.customerName || '—',
        orNumber: c.orNumber || c.id,
        paymentMethod: 'credit (settled)',
        amount: c.totalAmount || 0,
        type: 'credit',
      }));

    return [...cashTxns, ...paidCredits].sort((a, b) =>
      (b.date || '').localeCompare(a.date || '')
    );
  }, [transactions, credits]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const openPaymentModal = (credit) => {
    setPaymentTarget(credit);
    setPaymentAmount('');
    setPaymentNote('');
    setPaymentError('');
  };

  const handleSubmitPayment = async () => {
    const amt = parseFloat(paymentAmount);
    if (!amt || amt <= 0) { setPaymentError('Enter a valid amount.'); return; }
    if (amt > (paymentTarget.remainingBalance || 0) + 0.001) {
      setPaymentError(`Amount exceeds remaining balance of ${fmt(paymentTarget.remainingBalance)}.`);
      return;
    }
    setIsSubmitting(true);
    setPaymentError('');
    try {
      await onAddCreditPayment(paymentTarget.id, amt, paymentNote.trim());
      setPaymentTarget(null);
    } catch (err) {
      setPaymentError(err.message || 'Failed to record payment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openDueDateModal = (credit) => {
    setDueDateTarget(credit);
    setNewDueDate(credit.dueDate || '');
  };

  const handleSaveDueDate = async () => {
    if (!newDueDate) return;
    setIsDueSaving(true);
    try {
      await onUpdateCreditDueDate(dueDateTarget.id, newDueDate);
      setDueDateTarget(null);
    } finally {
      setIsDueSaving(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="container-fluid py-3">
      <div className="d-flex align-items-center mb-4">
        <h4 className="mb-0 fw-bold">
          <i className="bi bi-credit-card-2-front me-2 text-accent" />
          Ledger
        </h4>
      </div>

      {/* Tabs */}
      <ul className="nav nav-tabs mb-4 flex-row flex-nowrap">
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'credit' ? 'active' : ''}`}
            onClick={() => setActiveTab('credit')}
          >
            <i className="bi bi-journal-text me-1" />Credit Ledger
            {stats.unpaidCount > 0 && (
              <span className="badge bg-danger ms-2">{stats.unpaidCount}</span>
            )}
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'cash' ? 'active' : ''}`}
            onClick={() => setActiveTab('cash')}
          >
            <i className="bi bi-cash-stack me-1" />Cash Ledger
          </button>
        </li>
      </ul>

      {/* ── CREDIT LEDGER TAB ── */}
      {activeTab === 'credit' && (
        <>
          {/* Stats */}
          <div className="row g-3 mb-4">
            <div className="col-6 col-md-3">
              <div className="card card-custom text-center p-3">
                <div className="text-muted small">Total Credit</div>
                <div className="fw-bold fs-5">{fmt(stats.totalCredit)}</div>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="card card-custom text-center p-3">
                <div className="text-muted small">Outstanding</div>
                <div className="fw-bold fs-5 text-danger">{fmt(stats.totalOutstanding)}</div>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="card card-custom text-center p-3">
                <div className="text-muted small">Overdue</div>
                <div className={`fw-bold fs-5 ${stats.overdueCount > 0 ? 'text-danger' : 'text-muted'}`}>
                  {stats.overdueCount}
                </div>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="card card-custom text-center p-3">
                <div className="text-muted small">Unpaid / Partial</div>
                <div className="fw-bold fs-5">{stats.unpaidCount}</div>
              </div>
            </div>
          </div>

          {/* Filters & Search */}
          <div className="d-flex gap-2 flex-wrap mb-3 align-items-center">
            {[
              { key: 'active',  label: 'Active' },
              { key: 'overdue', label: 'Overdue' },
              { key: 'unpaid',  label: 'Unpaid' },
              { key: 'partial', label: 'Partial' },
              { key: 'paid',    label: 'Paid' },
              { key: 'all',     label: 'All' },
            ].map(f => (
              <button
                key={f.key}
                className={`btn btn-sm ${statusFilter === f.key ? 'btn-process' : 'btn-outline-secondary'}`}
                onClick={() => setStatusFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
            <input
              className="form-control form-control-sm ms-auto"
              style={{ maxWidth: 200 }}
              placeholder="Search customer / OR#"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Credit cards */}
          {filteredCredits.length === 0 ? (
            <div className="text-center text-muted py-5">
              <i className="bi bi-inbox display-4 d-block mb-2" />
              No credit entries found.
            </div>
          ) : (
            filteredCredits.map(credit => (
              <CreditCard
                key={credit.id}
                credit={credit}
                currentUser={currentUser}
                onAddPayment={openPaymentModal}
                onEditDueDate={openDueDateModal}
                onViewItems={setItemsTarget}
              />
            ))
          )}
        </>
      )}

      {/* ── CASH LEDGER TAB ── */}
      {activeTab === 'cash' && (
        <>
          <div className="mb-3 text-muted small">
            Showing all cash, GCash, and bank transfer transactions, plus fully settled credits.
          </div>
          {cashLedgerRows.length === 0 ? (
            <div className="text-center text-muted py-5">
              <i className="bi bi-inbox display-4 d-block mb-2" />
              No records found.
            </div>
          ) : (
            <div className="card card-custom">
              <div className="table-responsive">
                <table className="table table-hover mb-0 small">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Customer</th>
                      <th>OR #</th>
                      <th>Payment</th>
                      <th className="text-end">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashLedgerRows.map(row => (
                      <tr key={`${row.type}-${row.id}`}>
                        <td>{row.date || '—'}</td>
                        <td>{row.customerName}</td>
                        <td className="text-muted">{row.orNumber || row.id?.slice(-8) || '—'}</td>
                        <td>
                          <span className={`badge ${
                            row.paymentMethod === 'cash' ? 'bg-success' :
                            row.paymentMethod === 'gcash' ? 'bg-primary' :
                            row.paymentMethod === 'bank' ? 'bg-info text-dark' :
                            'bg-secondary'
                          }`}>
                            {row.paymentMethod}
                          </span>
                        </td>
                        <td className="text-end fw-semibold">{fmt(row.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── ADD PAYMENT MODAL ── */}
      {paymentTarget && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setPaymentTarget(null)}>
          <div className="modal-dialog modal-dialog-centered" onClick={e => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Add Payment</h5>
                <button className="btn-close" onClick={() => setPaymentTarget(null)} />
              </div>
              <div className="modal-body">
                <div className="mb-2">
                  <strong>{paymentTarget.customerName}</strong>
                  <div className="small text-muted">
                    Balance: <span className="text-danger fw-bold">{fmt(paymentTarget.remainingBalance)}</span>
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label small fw-semibold">Amount Received</label>
                  <input
                    type="number"
                    className="form-control"
                    min="1"
                    max={paymentTarget.remainingBalance}
                    step="0.01"
                    value={paymentAmount}
                    onChange={e => setPaymentAmount(e.target.value)}
                    autoFocus
                  />
                  <div className="d-flex gap-2 mt-2">
                    <button
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => setPaymentAmount(String(paymentTarget.remainingBalance))}
                    >
                      Full ({fmt(paymentTarget.remainingBalance)})
                    </button>
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label small fw-semibold">Note (optional)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Cash via pickup"
                    value={paymentNote}
                    onChange={e => setPaymentNote(e.target.value)}
                  />
                </div>

                {paymentError && (
                  <div className="alert alert-danger small py-2">{paymentError}</div>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary btn-sm" onClick={() => setPaymentTarget(null)}>
                  Cancel
                </button>
                <button
                  className="btn btn-process btn-sm"
                  onClick={handleSubmitPayment}
                  disabled={isSubmitting || !paymentAmount}
                >
                  {isSubmitting ? 'Saving…' : 'Record Payment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT DUE DATE MODAL ── */}
      {dueDateTarget && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setDueDateTarget(null)}>
          <div className="modal-dialog modal-dialog-centered modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Edit Due Date</h5>
                <button className="btn-close" onClick={() => setDueDateTarget(null)} />
              </div>
              <div className="modal-body">
                <div className="mb-2 small"><strong>{dueDateTarget.customerName}</strong></div>
                <input
                  type="date"
                  className="form-control"
                  value={newDueDate}
                  onChange={e => setNewDueDate(e.target.value)}
                />
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary btn-sm" onClick={() => setDueDateTarget(null)}>
                  Cancel
                </button>
                <button
                  className="btn btn-process btn-sm"
                  onClick={handleSaveDueDate}
                  disabled={isDueSaving || !newDueDate}
                >
                  {isDueSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── VIEW ITEMS MODAL ── */}
      {itemsTarget && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setItemsTarget(null)}>
          <div className="modal-dialog modal-dialog-centered" onClick={e => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Items — {itemsTarget.customerName}</h5>
                <button className="btn-close" onClick={() => setItemsTarget(null)} />
              </div>
              <div className="modal-body p-0">
                <table className="table table-sm mb-0">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th className="text-center">Qty</th>
                      <th className="text-end">Price</th>
                      <th className="text-end">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(itemsTarget.items || []).map((item, i) => (
                      <tr key={i}>
                        <td>
                          {item.name}
                          {item.variantName && <span className="text-muted ms-1 small">({item.variantName})</span>}
                        </td>
                        <td className="text-center">{item.qty} {item.unit || ''}</td>
                        <td className="text-end">{fmt(item.price)}</td>
                        <td className="text-end">{fmt(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={3} className="text-end fw-bold">Total</td>
                      <td className="text-end fw-bold">{fmt(itemsTarget.totalAmount)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary btn-sm" onClick={() => setItemsTarget(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
