import React from 'react';
import { AlertTriangle, ClipboardCopy, Download, Printer } from 'lucide-react';
import { ModalShell } from '@/components/ui/modal-shell';
import { ROLE_LABEL } from '@/constants/roles';
import { routeHref } from '@/lib/router';
import type { AccountCredential, Portal } from '@/types/authType';

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

export const CredentialsModal: React.FC<{ creds: AccountCredential[]; title: string; onClose: () => void; onToast: (m: string) => void }> = ({
  creds,
  title,
  onClose,
  onToast,
}) => {
  const loginUrlOf = (c: AccountCredential) => routeHref(c.user.role as Portal);

  const copyAll = async () => {
    const text = creds
      .map((c) => `${c.user.full_name} (${c.user.class_name ?? ROLE_LABEL[c.user.role]}) – Trang: ${loginUrlOf(c)} – Tên đăng nhập: ${c.user.username} – Mật khẩu: ${c.password}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      onToast('📋 Đã sao chép danh sách tài khoản');
    } catch {
      onToast('⚠️ Trình duyệt không cho sao chép – hãy dùng Tải CSV');
    }
  };

  const downloadCsv = () => {
    const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const rows = [
      ['Họ tên', 'Vai trò', 'Lớp', 'Trang đăng nhập', 'Tên đăng nhập', 'Mật khẩu tạm'],
      ...creds.map((c) => [c.user.full_name, ROLE_LABEL[c.user.role], c.user.class_name ?? '', loginUrlOf(c), c.user.username, c.password]),
    ];
    const csv = '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `tai-khoan-dong-a-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printCards = () => {
    const w = window.open('', '_blank');
    if (!w) return onToast('⚠️ Trình duyệt chặn cửa sổ in – hãy cho phép pop-up');
    const cards = creds
      .map(
        (c) => `<div class="card"><div class="brand">đông a</div><div class="name">${escapeHtml(c.user.full_name)}</div>
        <div class="meta">${escapeHtml(ROLE_LABEL[c.user.role])}${c.user.class_name ? ' • Lớp ' + escapeHtml(c.user.class_name) : ''}</div>
        <div class="row"><span>Tên đăng nhập</span><b>${escapeHtml(c.user.username)}</b></div>
        <div class="row"><span>Mật khẩu tạm</span><b>${escapeHtml(c.password)}</b></div>
        <div class="foot">Đăng nhập tại ${escapeHtml(loginUrlOf(c))} và đổi mật khẩu ở lần đầu.</div></div>`
      )
      .join('');
    w.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Phiếu tài khoản Đông A</title><style>
      body{font-family:Nunito,Segoe UI,sans-serif;margin:16px;color:#1c1917}
      .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
      .card{border:2px dashed #6b6560;border-radius:14px;padding:14px;break-inside:avoid}
      .brand{color:#0f766e;font-weight:900;font-size:18px}.name{font-weight:900;font-size:17px;margin-top:4px}
      .meta{color:#777;font-size:13px;margin-bottom:8px}.row{display:flex;justify-content:space-between;font-size:14px;padding:3px 0}
      .row b{font-family:Consolas,monospace;font-size:15px}.foot{color:#777;font-size:11px;margin-top:8px}
    </style></head><body><div class="grid">${cards}</div></body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  return (
    <ModalShell title={title} onClose={onClose} wide>
      <div className="p-6">
        <div className="rounded-2xl bg-duo-gold-light text-duo-gold-dark font-bold text-sm px-4 py-3 flex items-start gap-2 mb-4">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          Mật khẩu tạm chỉ hiển thị MỘT lần. Hãy tải CSV hoặc in phiếu để phát cho {creds.length > 1 ? `${creds.length} người dùng` : 'người dùng'} trước khi đóng.
        </div>
        <div className="rounded-2xl bg-duo-blue-light text-duo-blue-dark font-bold text-sm px-4 py-3 mb-4 space-y-0.5">
          {creds.some((c) => c.user.role === 'student') && (
            <p>
              Học sinh đăng nhập tại: <span className="font-mono font-black">{routeHref('student')}</span>
            </p>
          )}
          {creds.some((c) => c.user.role === 'teacher') && (
            <p>
              Giáo viên đăng nhập tại: <span className="font-mono font-black">{routeHref('teacher')}</span>
            </p>
          )}
        </div>
        <div className="overflow-x-auto rounded-2xl border-2 border-duo-swan">
          <table className="w-full text-sm">
            <thead className="bg-duo-polar text-duo-wolf text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-2.5 font-black">Họ tên</th>
                <th className="text-left px-4 py-2.5 font-black">Lớp</th>
                <th className="text-left px-4 py-2.5 font-black">Tên đăng nhập</th>
                <th className="text-left px-4 py-2.5 font-black">Mật khẩu tạm</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-duo-swan">
              {creds.map((c) => (
                <tr key={c.user.id}>
                  <td className="px-4 py-2.5 font-black text-duo-ink">{c.user.full_name}</td>
                  <td className="px-4 py-2.5 font-bold text-duo-wolf">{c.user.class_name ?? '—'}</td>
                  <td className="px-4 py-2.5 font-mono font-bold text-duo-blue-dark">{c.user.username}</td>
                  <td className="px-4 py-2.5 font-mono font-bold text-duo-ink">{c.password}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap justify-end gap-3 mt-5">
          <button onClick={copyAll} className="btn-3d btn-outline">
            <ClipboardCopy className="w-4 h-4" /> Sao chép
          </button>
          <button onClick={downloadCsv} className="btn-3d btn-outline !text-duo-green-dark">
            <Download className="w-4 h-4" /> Tải CSV
          </button>
          <button onClick={printCards} className="btn-3d btn-outline !text-kh-purple">
            <Printer className="w-4 h-4" /> In phiếu
          </button>
          <button onClick={onClose} className="btn-3d btn-green">
            Xong
          </button>
        </div>
      </div>
    </ModalShell>
  );
};
