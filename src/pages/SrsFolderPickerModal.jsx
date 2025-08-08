//src/pages/SrsFolderPickerModal.jsx

import React, { useEffect, useState } from 'react';
import { SrsApi } from '../api/srs';

export default function SrsFolderPickerModal({ show, onClose, onPick }) {
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (!show) return;
    let m = true;
    (async () => {
      try { setLoading(true);
        const data = await SrsApi.picker();
        if (m) setFolders(Array.isArray(data) ? data : []);
      } finally { if (m) setLoading(false); }
    })();
    return () => { m = false; };
  }, [show]);

  if (!show) return null;
  return (
    <div className="modal show d-block" tabIndex="-1">
      <div className="modal-dialog"><div className="modal-content">
        <div className="modal-header">
          <h5 className="modal-title">SRS 폴더 선택</h5>
          <button type="button" className="btn-close" onClick={onClose}></button>
        </div>
        <div className="modal-body">
          {loading ? <div>불러오는 중…</div> :
            folders.length === 0 ? <div className="text-muted">폴더가 없습니다. SRS에서 폴더를 먼저 만드세요.</div> :
            <ul className="list-group">
              {folders.map(f => (
                <li key={f.id} className="list-group-item d-flex justify-content-between align-items-center">
                  <span>{f.name} <small className="text-muted ms-2">{new Date(f.date).toISOString().slice(0,10)}</small></span>
                  <button className="btn btn-sm btn-primary" onClick={() => onPick(f.id)}>선택</button>
                </li>
              ))}
            </ul>
          }
        </div>
      </div></div>
    </div>
  );
}
