import { useState, useRef } from 'react';
import { printViaBluetooth } from '../utils/escpos';

const STORE_INFO = {
  storeName: "CARREN'S STORE",
  address:   'Urdaneta, Ilocos',
  phone:     '09XX-XXX-XXXX',
};

// Known category visual config — fallback palette for custom categories
const KNOWN_CONFIG = {
  'Eggs':        { emoji: '🥚', color: '#f59e0b' },
  'Mantika':     { emoji: '🫙', color: '#3b82f6' },
  'Daily Needs': { emoji: '🛍️', color: '#10b981' },
};
const PALETTE = [
  { emoji: '📦', color: '#8b5cf6' },
  { emoji: '🏪', color: '#ef4444' },
  { emoji: '🧴', color: '#f97316' },
  { emoji: '🥫', color: '#06b6d4' },
  { emoji: '🧃', color: '#84cc16' },
  { emoji: '🍬', color: '#ec4899' },
];
const getCatConfig = (cat, allCats) => {
  if (KNOWN_CONFIG[cat]) return KNOWN_CONFIG[cat];
  const idx = allCats.indexOf(cat);
  return PALETTE[idx % PALETTE.length];
};

// BLE service UUIDs commonly used for data transfer from POS terminals
const POS_BLE_PROFILES = [
  { service: 'e7810a71-73ae-499d-8c15-faa9aef0c3f2', characteristic: 'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f' },
  { service: '000018f0-0000-1000-8000-00805f9b34fb', characteristic: '00002af1-0000-1000-8000-00805f9b34fb' },
  { service: '0000ff00-0000-1000-8000-00805f9b34fb', characteristic: '0000ff02-0000-1000-8000-00805f9b34fb' },
];

export default function POS({ products, setProducts, transactions, setTransactions, currentUser, categories }) {
  const [activeCategory, setActiveCategory] = useState('All');
  const [search, setSearch] = useState('');

  // Incoming transaction from POS machine (via Bluetooth or manual confirm)
  const [incomingCart, setIncomingCart] = useState([]);
  const [cashInput, setCashInput]       = useState('');
  const [showReceipt, setShowReceipt]   = useState(false);
  const [lastTxn, setLastTxn]           = useState(null);
  const [printStatus, setPrintStatus]   = useState('');
  const [isPrinting, setIsPrinting]     = useState(false);

  // Bluetooth POS device state
  const [btStatus, setBtStatus]   = useState('disconnected'); // disconnected | connecting | connected | error
  const [btDeviceName, setBtDeviceName] = useState('');
  const [btError, setBtError]     = useState('');
  const btDeviceRef = useRef(null);
  const btCharRef   = useRef(null);
  const rxBufferRef = useRef('');

  const catTabs = ['All', ...categories];
  const filtered = products.filter(p => {
    const catMatch  = activeCategory === 'All' || p.category === activeCategory;
    const nameMatch = p.name.toLowerCase().includes(search.toLowerCase());
    return catMatch && nameMatch;
  });

  const groupedProducts = categories.reduce((acc, cat) => {
    const items = filtered.filter(p => p.category === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {});

  /* ═══════════════════════════════════════════
     BLUETOOTH — Connect to Physical POS Machine
     The POS machine acts as BLE peripheral and
     sends JSON transaction data when finalized.
     Format: {"items":[{"name":"...","price":8,"qty":2,"total":16}],"cash":20,"change":4}
  ═══════════════════════════════════════════ */
  const connectPosMachine = async () => {
    if (!navigator.bluetooth) {
      setBtError('Web Bluetooth is not available. Use Chrome or Edge on a secure context (localhost or HTTPS).');
      setBtStatus('error');
      return;
    }

    setBtStatus('connecting');
    setBtError('');

    try {
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: POS_BLE_PROFILES.map(p => p.service),
      });

      btDeviceRef.current = device;
      setBtDeviceName(device.name || 'POS Machine');

      device.addEventListener('gattserverdisconnected', () => {
        setBtStatus('disconnected');
        setBtDeviceName('');
        btCharRef.current = null;
      });

      const server = await device.gatt.connect();
      let characteristic = null;

      for (const profile of POS_BLE_PROFILES) {
        try {
          const svc = await server.getPrimaryService(profile.service);
          characteristic = await svc.getCharacteristic(profile.characteristic);
          break;
        } catch { continue; }
      }

      if (!characteristic) {
        device.gatt.disconnect();
        setBtStatus('error');
        setBtError('No compatible BLE service found on this device.');
        return;
      }

      btCharRef.current = characteristic;

      // Listen for incoming data (the POS machine sends transaction JSON)
      await characteristic.startNotifications();
      characteristic.addEventListener('characteristicvaluechanged', (event) => {
        const chunk = new TextDecoder().decode(event.target.value);
        rxBufferRef.current += chunk;
        // Transactions are terminated with newline or are complete JSON
        try {
          const parsed = JSON.parse(rxBufferRef.current.trim());
          rxBufferRef.current = '';
          handleIncomingTransaction(parsed);
        } catch {
          // Not yet a complete JSON — keep buffering
        }
      });

      setBtStatus('connected');
    } catch (err) {
      setBtStatus('error');
      setBtError(err.message);
    }
  };

  const disconnectPosMachine = () => {
    if (btDeviceRef.current?.gatt?.connected) {
      btDeviceRef.current.gatt.disconnect();
    }
    setBtStatus('disconnected');
    setBtDeviceName('');
    btCharRef.current = null;
  };

  /* ═══════════════════════════════════════════
     Handle incoming transaction from POS machine
     Expected format:
     {
       items: [{ name, price, qty, total }],
       cash: number,
       change: number
     }
  ═══════════════════════════════════════════ */
  const handleIncomingTransaction = (data) => {
    if (data?.items?.length > 0) {
      setIncomingCart(data.items);
      setCashInput(String(data.cash || ''));
    }
  };

  // Derived totals
  const subtotal = incomingCart.reduce((s, i) => s + i.total, 0);
  const cash     = parseFloat(cashInput) || 0;
  const change   = cash - subtotal;

  const removeItem = (idx) => setIncomingCart(prev => prev.filter((_, i) => i !== idx));

  const handleProcess = () => {
    if (incomingCart.length === 0 || cash < subtotal) return;

    const now     = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().slice(0, 5);
    const txnId   = `TXN-${dateStr.replace(/-/g, '')}-${String(transactions.length + 1).padStart(4, '0')}`;

    const txn = {
      id: txnId, date: dateStr, time: timeStr,
      cashierId: currentUser.id, cashierName: currentUser.name,
      items: incomingCart.map(i => ({ ...i })),
      subtotal, cash, change,
    };

    // Deduct stock for matched products by name
    setProducts(prev => prev.map(p => {
      const cartItem = incomingCart.find(i => i.name === p.name);
      return cartItem ? { ...p, stock: Math.max(0, p.stock - cartItem.qty) } : p;
    }));

    setTransactions(prev => [...prev, txn]);
    setLastTxn(txn);
    setShowReceipt(true);
    setIncomingCart([]);
    setCashInput('');
  };

  const handlePrintBT = async () => {
    if (!lastTxn) return;
    setIsPrinting(true);
    setPrintStatus('');
    try {
      await printViaBluetooth({
        ...STORE_INFO,
        txnId:        lastTxn.id,
        date:         lastTxn.date,
        time:         lastTxn.time,
        cashierName:  lastTxn.cashierName,
        items:        lastTxn.items,
        total:        lastTxn.subtotal,
        cash:         lastTxn.cash,
        change:       lastTxn.change,
      }, setPrintStatus);
    } catch (err) {
      setPrintStatus('Error: ' + err.message);
    } finally {
      setIsPrinting(false);
    }
  };

  const handleQuickCash = (amount) => setCashInput(String(amount));

  const btStatusConfig = {
    disconnected: { label: 'Not Connected',  cls: 'text-muted',   dot: '#6c757d' },
    connecting:   { label: 'Connecting...',   cls: 'text-warning', dot: '#ffc107' },
    connected:    { label: btDeviceName || 'Connected', cls: 'text-success', dot: '#198754' },
    error:        { label: 'Connection Error', cls: 'text-danger',  dot: '#dc3545' },
  }[btStatus];

  return (
    <div className="pos-layout">

      {/* ═════════════ LEFT: Product Reference Panel ═════════════ */}
      <div className="pos-products">
        <div className="pos-products-header">
          <div className="pos-products-title">
            <i className="bi bi-grid-3x3-gap me-2"></i>Product Reference
          </div>
          <div className="input-group input-group-sm" style={{ maxWidth: 200 }}>
            <span className="input-group-text bg-light"><i className="bi bi-search text-muted" style={{ fontSize: '0.7rem' }}></i></span>
            <input
              type="text"
              className="form-control form-control-sm"
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Category tabs */}
        <div className="category-tabs mb-2">
          {catTabs.map(cat => {
            const cfg = getCatConfig(cat, categories);
            return (
              <button
                key={cat}
                className={`cat-tab ${activeCategory === cat ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat === 'All'
                  ? <i className="bi bi-grid me-1"></i>
                  : <span className="me-1" style={{ fontSize: '0.85em' }}>{cfg.emoji}</span>
                }
                {cat}
              </button>
            );
          })}
        </div>

        {/* Product grid */}
        <div className="pos-products-scroll">
          {activeCategory === 'All' ? (
            Object.keys(groupedProducts).length === 0 ? (
              <div className="text-center text-muted py-4 small">
                <i className="bi bi-box-seam fs-2 d-block mb-2"></i>No products found
              </div>
            ) : (
              Object.entries(groupedProducts).map(([cat, items]) => {
                const cfg = getCatConfig(cat, categories);
                return (
                  <div key={cat} className="category-group mb-3">
                    <div className="category-group-header" style={{ borderLeftColor: cfg.color }}>
                      <span className="category-group-emoji">{cfg.emoji}</span>
                      <span className="category-group-name">{cat}</span>
                      <span className="category-group-count">{items.length}</span>
                    </div>
                    <div className="product-grid">
                      {items.map(p => renderCard(p, getCatConfig(p.category, categories)))}
                    </div>
                  </div>
                );
              })
            )
          ) : (
            <div className="product-grid">
              {filtered.map(p => renderCard(p, getCatConfig(p.category, categories)))}
              {filtered.length === 0 && (
                <div className="col-span-all text-center text-muted py-4 small">
                  <i className="bi bi-box-seam fs-2 d-block mb-2"></i>No items
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ═════════════ RIGHT: Transaction Panel ═════════════ */}
      <div className="pos-cart">

        {/* BT POS Machine Connection */}
        <div className="bt-pos-widget">
          <div className="bt-pos-title">
            <i className="bi bi-pc-display me-1"></i> POS Machine Sync
          </div>
          <div className="bt-pos-status">
            <span className="bt-dot" style={{ background: btStatusConfig.dot }}></span>
            <span className={btStatusConfig.cls}>{btStatusConfig.label}</span>
          </div>

          {btStatus === 'error' && btError && (
            <div className="bt-error-msg">{btError}</div>
          )}

          <div className="d-flex gap-1 mt-2">
            {btStatus !== 'connected' ? (
              <button
                className="btn btn-sm btn-primary w-100"
                onClick={connectPosMachine}
                disabled={btStatus === 'connecting'}
              >
                {btStatus === 'connecting'
                  ? <><span className="spinner-border spinner-border-sm me-1"></span>Connecting...</>
                  : <><i className="bi bi-bluetooth me-1"></i>Connect POS Machine</>
                }
              </button>
            ) : (
              <button className="btn btn-sm btn-outline-danger w-100" onClick={disconnectPosMachine}>
                <i className="bi bi-bluetooth me-1"></i>Disconnect
              </button>
            )}
          </div>

          {btStatus === 'connected' && (
            <div className="bt-connected-hint">
              <i className="bi bi-check-circle-fill text-success me-1"></i>
              Waiting for transaction from POS machine...
            </div>
          )}
        </div>

        {/* Cart Header */}
        <div className="cart-header">
          <i className="bi bi-receipt me-2"></i>Current Transaction
          {incomingCart.length > 0 && (
            <button className="btn btn-link text-danger p-0 ms-auto small" onClick={() => { setIncomingCart([]); setCashInput(''); }}>
              <i className="bi bi-trash me-1"></i>Clear
            </button>
          )}
        </div>

        {/* Cart Items */}
        <div className="cart-items">
          {incomingCart.length === 0 ? (
            <div className="empty-cart">
              <i className="bi bi-pc-display-horizontal fs-1 text-muted"></i>
              <p className="text-muted mt-2 mb-0 small">
                No transaction received yet.<br />
                Connect the POS machine via Bluetooth<br />to sync items automatically.
              </p>
            </div>
          ) : (
            incomingCart.map((item, idx) => (
              <div key={idx} className="cart-item">
                <div className="cart-item-info">
                  <div className="cart-item-name">{item.name}</div>
                  <div className="cart-item-price text-muted small">
                    ₱{item.price} × {item.qty}
                  </div>
                </div>
                <div className="cart-item-controls">
                  <span className="cart-item-total">₱{item.total}</span>
                  <button className="btn btn-link text-danger p-0 ms-1" onClick={() => removeItem(idx)}>
                    <i className="bi bi-x-circle-fill"></i>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Payment */}
        <div className="cart-payment">
          <div className="d-flex justify-content-between mb-2">
            <span className="fs-6 fw-semibold">Total</span>
            <span className="fs-5 fw-bold text-dark">₱{subtotal.toLocaleString()}</span>
          </div>

          <div className="mb-2">
            <label className="form-label small fw-semibold mb-1">Cash Received (₱)</label>
            <input
              type="number"
              className="form-control form-control-lg text-end fw-bold"
              placeholder="0.00"
              value={cashInput}
              onChange={e => setCashInput(e.target.value)}
              min="0"
            />
            <div className="d-flex gap-1 mt-1 flex-wrap">
              {[20, 50, 100, 200, 500, 1000].map(amt => (
                <button key={amt} className="btn btn-outline-secondary btn-sm flex-fill" onClick={() => handleQuickCash(amt)}>
                  ₱{amt}
                </button>
              ))}
              <button className="btn btn-outline-secondary btn-sm flex-fill" onClick={() => handleQuickCash(subtotal)}>
                Exact
              </button>
            </div>
          </div>

          {cashInput && (
            <div className={`change-display ${change < 0 ? 'insufficient' : ''}`}>
              <span>{change < 0 ? '⚠ Insufficient' : 'Change'}</span>
              <span className="fs-4 fw-bold">
                {change < 0 ? `-₱${Math.abs(change).toFixed(2)}` : `₱${change.toFixed(2)}`}
              </span>
            </div>
          )}

          <button
            className="btn btn-process w-100 mt-3"
            onClick={handleProcess}
            disabled={incomingCart.length === 0 || !cashInput || change < 0}
          >
            <i className="bi bi-check-circle-fill me-2"></i>
            Process & Save Transaction
          </button>
        </div>
      </div>

      {/* ═════════════ Receipt Modal ═════════════ */}
      {showReceipt && lastTxn && (
        <div className="modal fade show d-block" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered modal-sm">
            <div className="modal-content">
              <div className="modal-header bg-success text-white">
                <h5 className="modal-title">
                  <i className="bi bi-check-circle-fill me-2"></i>Transaction Complete!
                </h5>
                <button className="btn-close btn-close-white" onClick={() => setShowReceipt(false)}></button>
              </div>
              <div className="modal-body p-0">
                <div className="receipt-preview">
                  <div className="text-center mb-2">
                    <strong className="fs-6">{STORE_INFO.storeName}</strong><br />
                    <small className="text-muted">{STORE_INFO.address}</small><br />
                    <small className="text-muted">{STORE_INFO.phone}</small>
                  </div>
                  <hr className="receipt-dashed" />
                  <div className="receipt-info">
                    <div className="d-flex justify-content-between small"><span>TXN #:</span><span>{lastTxn.id}</span></div>
                    <div className="d-flex justify-content-between small"><span>Date:</span><span>{lastTxn.date}</span></div>
                    <div className="d-flex justify-content-between small"><span>Time:</span><span>{lastTxn.time}</span></div>
                    <div className="d-flex justify-content-between small"><span>Cashier:</span><span>{lastTxn.cashierName}</span></div>
                  </div>
                  <hr className="receipt-dashed" />
                  <table className="w-100 small">
                    <tbody>
                      {lastTxn.items.map((item, i) => (
                        <tr key={i}>
                          <td>
                            <div>{item.name}</div>
                            {item.qty > 1 && <div className="text-muted" style={{ fontSize: '0.68rem' }}>@ ₱{item.price} × {item.qty}</div>}
                          </td>
                          <td className="text-end fw-semibold">₱{item.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <hr className="receipt-dashed" />
                  <div className="d-flex justify-content-between fw-bold"><span>TOTAL</span><span>₱{lastTxn.subtotal}</span></div>
                  <div className="d-flex justify-content-between small"><span>CASH</span><span>₱{lastTxn.cash}</span></div>
                  <div className="d-flex justify-content-between small text-success fw-semibold"><span>CHANGE</span><span>₱{lastTxn.change}</span></div>
                  <hr className="receipt-dashed" />
                  <div className="text-center small text-muted">Salamat sa inyong pagbili!</div>
                </div>
                {printStatus && (
                  <div className={`p-2 text-center small ${printStatus.includes('Error') ? 'text-danger bg-danger-subtle' : 'text-success bg-success-subtle'}`}>
                    {printStatus}
                  </div>
                )}
              </div>
              <div className="modal-footer flex-column gap-2 p-2">
                <button className="btn btn-dark w-100" onClick={handlePrintBT} disabled={isPrinting}>
                  {isPrinting
                    ? <><span className="spinner-border spinner-border-sm me-2"></span>Printing...</>
                    : <><i className="bi bi-printer-fill me-2"></i>Print Receipt (Bluetooth)</>
                  }
                </button>
                <button className="btn btn-outline-secondary w-100" onClick={() => { setShowReceipt(false); setLastTxn(null); setPrintStatus(''); }}>
                  <i className="bi bi-check2 me-2"></i>Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Compact product reference card
  function renderCard(product, cfg) {
    cfg = cfg || getCatConfig(product.category, categories);
    const isLow = product.stock > 0 && product.stock <= product.lowStockAlert;
    const isOut = product.stock <= 0;
    return (
      <div
        key={product.id}
        className={`product-card-ref ${isOut ? 'out-of-stock' : ''} ${isLow ? 'low-stock' : ''}`}
        title={product.name}
      >
        <div className="pcr-emoji">{cfg.emoji}</div>
        <div className="pcr-name">{product.name}</div>
        <div className="pcr-price">₱{product.price}</div>
        <div className="pcr-unit text-muted">/{product.unit}</div>
        {isOut ? (
          <span className="stock-badge out">OUT</span>
        ) : isLow ? (
          <span className="stock-badge low">{product.stock}</span>
        ) : (
          <span className="stock-badge ok">{product.stock}</span>
        )}
      </div>
    );
  }
}

