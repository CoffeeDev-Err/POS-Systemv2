import { useState } from 'react';

export default function Settings() {
  const [store, setStore] = useState({
    name: "CARREN'S STORE",
    address: 'Urdaneta, Ilocos',
    phone: '09XX-XXX-XXXX',
    receiptFooter: 'Salamat sa inyong pagbili! Please come again :)',
  });
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div>
      <div className="row g-4">
        {/* Store Info */}
        <div className="col-lg-6">
          <div className="card card-custom">
            <div className="card-header-custom"><i className="bi bi-shop me-2"></i>Store Information</div>
            <div className="card-body">
              <div className="mb-3">
                <label className="form-label fw-semibold">Store Name</label>
                <input className="form-control" value={store.name} onChange={e => setStore({ ...store, name: e.target.value })} />
              </div>
              <div className="mb-3">
                <label className="form-label fw-semibold">Address</label>
                <input className="form-control" value={store.address} onChange={e => setStore({ ...store, address: e.target.value })} />
              </div>
              <div className="mb-3">
                <label className="form-label fw-semibold">Phone Number</label>
                <input className="form-control" value={store.phone} onChange={e => setStore({ ...store, phone: e.target.value })} />
              </div>
              <div className="mb-3">
                <label className="form-label fw-semibold">Receipt Footer Message</label>
                <textarea className="form-control" rows="2" value={store.receiptFooter} onChange={e => setStore({ ...store, receiptFooter: e.target.value })} />
              </div>
              {saved && <div className="alert alert-success py-2 small"><i className="bi bi-check-circle me-1"></i>Settings saved successfully!</div>}
              <button className="btn btn-dark" onClick={handleSave}>
                <i className="bi bi-save me-2"></i>Save Settings
              </button>
            </div>
          </div>
        </div>

        {/* Printer Info */}
        <div className="col-lg-6">
          <div className="card card-custom mb-3">
            <div className="card-header-custom"><i className="bi bi-printer me-2"></i>Printer Configuration</div>
            <div className="card-body">
              <div className="mb-3 p-3 bg-light rounded border">
                <div className="d-flex align-items-center gap-2 mb-2">
                  <i className="bi bi-bluetooth text-primary fs-5"></i>
                  <strong>Receipt Printer (Bluetooth)</strong>
                </div>
                <p className="text-muted small mb-1">Goojprt / Generic ESC/POS Thermal Printer</p>
                <ul className="text-muted small mb-0">
                  <li>Uses Web Bluetooth API (Chrome/Edge only)</li>
                  <li>ESC/POS commands — no SDK required</li>
                  <li>58mm or 80mm thermal paper</li>
                </ul>
                <div className="mt-2 alert alert-info py-1 px-2 small mb-0">
                  <i className="bi bi-info-circle me-1"></i>
                  Connect printer when processing a transaction.
                </div>
              </div>

              <div className="p-3 bg-light rounded border">
                <div className="d-flex align-items-center gap-2 mb-2">
                  <i className="bi bi-printer-fill text-dark fs-5"></i>
                  <strong>Reports Printer (Wired / Wi-Fi)</strong>
                </div>
                <p className="text-muted small mb-1">Standard A4 / Letter Printer</p>
                <ul className="text-muted small mb-0">
                  <li>Uses browser print dialog (Ctrl+P)</li>
                  <li>Works with any USB or network printer</li>
                  <li>A4 / Letter paper size</li>
                </ul>
                <div className="mt-2 alert alert-info py-1 px-2 small mb-0">
                  <i className="bi bi-info-circle me-1"></i>
                  Click "Print A4 Report" in the Reports page.
                </div>
              </div>
            </div>
          </div>

          {/* Backup */}
          <div className="card card-custom">
            <div className="card-header-custom"><i className="bi bi-database me-2"></i>Data & Backup</div>
            <div className="card-body">
              <p className="text-muted small mb-3">Export your data as a backup file, or restore from a previous backup.</p>
              <div className="d-flex gap-2">
                <button className="btn btn-outline-dark flex-fill" onClick={() => {
                  alert('Backup feature: In production, this will export all data as a JSON/Excel file.');
                }}>
                  <i className="bi bi-download me-2"></i>Export Backup
                </button>
                <button className="btn btn-outline-secondary flex-fill" onClick={() => {
                  alert('Restore feature: In production, this will import data from a backup file.');
                }}>
                  <i className="bi bi-upload me-2"></i>Restore
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* System Info */}
        <div className="col-12">
          <div className="card card-custom">
            <div className="card-header-custom"><i className="bi bi-info-circle me-2"></i>System Info</div>
            <div className="card-body">
              <div className="row g-3">
                {[
                  { label: 'System', value: "Carren's Store POS v1.0" },
                  { label: 'Mode', value: 'Sample / Demo Mode' },
                  { label: 'Browser', value: navigator.userAgent.includes('Chrome') ? 'Chrome ✓' : navigator.userAgent.includes('Firefox') ? 'Firefox' : 'Other' },
                  { label: 'Bluetooth Support', value: navigator.bluetooth ? '✅ Available' : '❌ Not supported (use Chrome/Edge)' },
                  { label: 'Platform', value: /Mobi|Android/i.test(navigator.userAgent) ? 'Mobile' : 'Desktop' },
                  { label: 'Language', value: 'Filipino / English' },
                ].map(({ label, value }) => (
                  <div className="col-6 col-md-4" key={label}>
                    <div className="text-muted small">{label}</div>
                    <div className="fw-semibold small">{value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
