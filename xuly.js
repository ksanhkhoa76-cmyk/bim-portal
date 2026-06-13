/* ====== Trạng thái toàn cục ====== */
let DU_AN = [];
let NHIEM_VU = [];
let maXacNhanCache = '';
let lanGhiCuoi = 0;
let maDangSua = null;
let uidDangSua = null;
let madaKanbanHienTai = null;
let kFilter = { hangmuc: null, nguoi: null };
let chonUids = new Set();      /* thẻ đang chọn — theo uid, giữ qua các lần vẽ lại */
let keoUids = [];              /* các uid đang kéo */
let ctxProjectMa = null;
let ctxTaskUids = [];
let demUid = 0;
const $ = id => document.getElementById(id);

document.title = TEN_DON_VI + ' — Quản lý dự án';
$('tenDonVi').textContent = TEN_DON_VI;
$('footDonVi').textContent = TEN_DON_VI;

/* ====== Tiện ích ====== */
function thoatHTML(s){ return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function boDau(s){ return String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().trim(); }
function noiCache(u){ return u + (u.includes('?') ? '&' : '?') + 't=' + Date.now(); }
function lopBadge(loai){
  const k = boDau(loai);
  if(k.includes('cau')) return 'b-cau';
  if(k.includes('duong')) return 'b-duong';
  if(k.includes('ha tang')) return 'b-ham';
  if(k.includes('kien truc') || k.includes('nha')) return 'b-nutgiao';
  return '';
}
function lopTrangThai(tt){
  const k = boDau(tt);
  if(k.includes('hoan thanh') || k.includes('hoan thien') || k.includes('ban giao')) return 'tt-xong';
  if(k.includes('ngung') || k.includes('tam dung') || k.includes('treo') || k.includes('huy')) return 'tt-dung';
  if(k.includes('dang')) return 'tt-chay';
  return 'tt-khac';
}
function docNgay(s){ const m = String(s ?? '').trim().match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/); if(!m) return null; const d = new Date(+m[3], +m[2]-1, +m[1]); return isNaN(d) ? null : d; }
function soNgayConLai(d){ if(!d) return null; const homNay = new Date(); homNay.setHours(0,0,0,0); return Math.round((d - homNay) / 86400000); }
function tinhTienDo(mada){
  const viec = NHIEM_VU.filter(v => v.mada === mada);
  if(viec.length === 0) return 0;
  const xong = viec.filter(v => boDau(v.trangthai).includes('hoan thanh')).length;
  return Math.round((xong / viec.length) * 100);
}
function chuanCot(tt){
  const COT = ['Chưa bắt đầu','Đang thực hiện / Chỉnh sửa','Trình duyệt KCS / TT','Hoàn thành'];
  if(COT.includes(tt)) return tt;
  const k = boDau(tt);
  if(k.includes('trinh duyet') || k.includes('cho duyet')) return 'Trình duyệt KCS / TT';
  if(k.includes('lam') || k.includes('thuc hien') || k.includes('chinh sua')) return 'Đang thực hiện / Chỉnh sửa';
  if(k.includes('hoan thanh') || k.includes('xong')) return 'Hoàn thành';
  return 'Chưa bắt đầu';
}
let toastTimer = null;
function baoToast(text, kieu){
  const t = $('toast');
  t.textContent = text;
  t.className = (kieu || '') + ' show';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>{ t.className = t.className.replace('show','').trim(); }, 3200);
}
function khoaCuon(){ document.body.classList.add('khoa-cuon'); }
function moCuonNeuHetModal(){
  if(!document.querySelector('.modal-overlay:not([hidden])')) document.body.classList.remove('khoa-cuon');
}
function moOverlay(id){ dongCtx(); $(id).hidden = false; khoaCuon(); }
function dongCtx(){ document.querySelectorAll('.context-menu').forEach(m=>m.classList.remove('show')); }

/* ====== Chuẩn hóa dữ liệu ====== */
function chuanHoaDong(row){
  const o = {}; for(const k in row) o[boDau(k)] = String(row[k] ?? '').trim();
  return {
    ma: o['ma'] || o['ma du an'] || o['ma da'] || '',
    ten: o['ten'] || o['ten du an'] || '',
    loai: o['loai'] || o['loai cong trinh'] || '',
    giaidoan: o['giai doan du an'] || o['giai doan'] || '',
    vaitro: o['vai tro'] || o['vai tro bim'] || '',
    phutrach: o['phu trach'] || o['nguoi phu trach'] || '',
    trangthai: o['trang thai'] || '',
    hannop: o['han nop'] || o['han'] || '',
    link: o['link'] || o['link portal'] || '#'
  };
}
function chuanHoaViec(row){
  const o = {}; for(const k in row) o[boDau(k)] = String(row[k] ?? '').trim();
  return {
    uid: ++demUid,
    mada: o['ma du an'] || o['ma da'] || o['mada'] || o['ma'] || o['thuoc du an'] || '',
    hangmuc: o['hang muc'] || o['hangmuc'] || o['phan loai'] || '',
    nhiemvu: o['nhiem vu'] || o['nhiemvu'] || o['noi dung cong viec'] || o['noi dung'] || '',
    nguoi: o['nguoi thuc hien'] || o['nguoi'] || o['nhan su'] || '',
    uutien: o['uu tien'] || o['uutien'] || '',
    han: o['han'] || o['han nop'] || o['deadline'] || '',
    trangthai: o['trang thai'] || 'Chưa bắt đầu',
    ghichu: o['ghi chu'] || o['ghichu'] || ''
  };
}

/* ====== Tải dữ liệu ====== */
async function taiNhiemVu(){
  if(!LINK_CSV_NHIEMVU || LINK_CSV_NHIEMVU.includes('DÁN_LINK')) return;
  try{
    const res = await fetch(noiCache(LINK_CSV_NHIEMVU));
    if(res.ok){
      const kq = Papa.parse(await res.text(), {header:true, skipEmptyLines:true});
      NHIEM_VU = kq.data.map(chuanHoaViec).filter(v => v.mada && v.nhiemvu);
    }
  }catch(e){ /* không sao */ }
}
async function taiDuLieu(){
  if(!LINK_CSV || LINK_CSV.includes('DÁN_LINK')) return;
  $('khuNoiDung').innerHTML = '<div class="loading">ĐANG ĐỒNG BỘ DỮ LIỆU TỪ GOOGLE SHEETS<div class="bar"></div></div>';
  try{
    const res = await fetch(noiCache(LINK_CSV));
    if(!res.ok) throw new Error('HTTP ' + res.status);
    const kq = Papa.parse(await res.text(), {header:true, skipEmptyLines:true});
    DU_AN = kq.data.map(chuanHoaDong).filter(d => d.ten || d.ma);
    if(DU_AN.length === 0) throw new Error('Bảng tính trống hoặc sai tiêu đề cột');
    await taiNhiemVu();
    chonUids.clear();
    $('khuNoiDung').innerHTML = '';
    $('lanDongBo').textContent = 'Đồng bộ lúc ' + new Date().toLocaleTimeString('vi-VN') + ' · ' + new Date().toLocaleDateString('vi-VN');
    dungBoLoc(); veDanhSach();
    if(!$('modalKanban').hidden) veKanban();
  }catch(err){
    $('khuNoiDung').innerHTML = '<div class="notice"><h2>⚠ Không tải được dữ liệu</h2><p>Chi tiết: <code>' + thoatHTML(err.message) + '</code></p><p>Kiểm tra link CSV / tên cột hàng 1, rồi bấm ⟳ thử lại.</p></div>';
  }
}
function dungBoLoc(){
  const them = (sel, arr) => {
    const v = sel.value; sel.length = 1;
    [...new Set(arr.filter(Boolean))].sort().forEach(x => sel.add(new Option(x)));
    sel.value = v;
  };
  them($('locLoai'), DU_AN.map(d=>d.loai));
  them($('locGiaiDoan'), DU_AN.map(d=>d.giaidoan));
  them($('locTrangThai'), DU_AN.map(d=>d.trangthai));
  $('thanhCongCu').hidden = false; $('daiSoLieu').hidden = false;
}

/* ====== Vẽ danh sách dự án ====== */
function dongMeta(nhan, giaTri){
  const co = giaTri && giaTri !== '-';
  return '<span class="m-lbl">' + nhan + '</span><span class="m-val' + (co ? '' : ' trong') + '">' + (co ? thoatHTML(giaTri) : '—') + '</span>';
}
function veDanhSach(){
  const kw = boDau($('oTimKiem').value), l = $('locLoai').value, g = $('locGiaiDoan').value, t = $('locTrangThai').value, sx = $('sapXep').value;
  let ds = DU_AN.filter(d =>
    (!kw || boDau(d.ten+' '+d.ma+' '+d.phutrach).includes(kw)) &&
    (!l || d.loai===l) && (!g || d.giaidoan===g) && (!t || d.trangthai===t)
  );
  ds.sort((a,b)=>{
    if(sx==='tiendo-asc') return tinhTienDo(a.ma) - tinhTienDo(b.ma);
    if(sx==='tiendo-desc') return tinhTienDo(b.ma) - tinhTienDo(a.ma);
    const na = docNgay(a.hannop), nb = docNgay(b.hannop);
    return (na?na.getTime():Infinity) - (nb?nb.getTime():Infinity);
  });

  $('stTong').textContent = ds.length;
  $('stTrienKhai').textContent = ds.filter(d => lopTrangThai(d.trangthai) === 'tt-chay').length;
  $('stTamNgung').textContent = ds.filter(d => lopTrangThai(d.trangthai) === 'tt-dung').length;
  const tong = ds.reduce((s,d)=>s+tinhTienDo(d.ma),0);
  $('stTienDo').textContent = (ds.length ? Math.round(tong/ds.length) : 0) + '%';
  $('stSapHan').textContent = ds.filter(d=>{ const n = soNgayConLai(docNgay(d.hannop)); return n !== null && n <= 15; }).length;
  $('thongBaoTrong').hidden = ds.length > 0;

  $('luoiDuAn').innerHTML = ds.map(d=>{
    const pct = tinhTienDo(d.ma);
    const cl = soNgayConLai(docNgay(d.hannop));
    const sv = NHIEM_VU.filter(v => v.mada === d.ma).length;
    let hn = '<div class="deadline">Hạn nộp: —</div>';
    if(cl !== null){
      if(cl < 0)        hn = '<div class="deadline qua-han">▲ QUÁ HẠN ' + (-cl) + ' ngày (' + thoatHTML(d.hannop) + ')</div>';
      else if(cl <= 15) hn = '<div class="deadline sap-han">● Còn ' + cl + ' ngày — hạn ' + thoatHTML(d.hannop) + '</div>';
      else              hn = '<div class="deadline con-han">○ Hạn nộp: ' + thoatHTML(d.hannop) + ' (còn ' + cl + ' ngày)</div>';
    } else if(d.hannop && d.hannop !== '-'){
      hn = '<div class="deadline">Hạn nộp: ' + thoatHTML(d.hannop) + '</div>';
    }
    return `
    <article class="card" data-ma="${thoatHTML(d.ma)}">
      <div class="card-top">
        <span class="card-ma">${thoatHTML(d.ma)}</span>
        <span class="badge ${lopBadge(d.loai)}">${thoatHTML(d.loai) || '—'}</span>
      </div>
      <h2>${thoatHTML(d.ten)}</h2>
      <div class="card-meta">
        ${dongMeta('Giai đoạn', d.giaidoan)}
        ${dongMeta('Vai trò', d.vaitro)}
        ${dongMeta('Phụ trách', d.phutrach)}
        <span class="m-lbl">Trạng thái</span>
        <span>${d.trangthai ? '<span class="tt-chip ' + lopTrangThai(d.trangthai) + '">' + thoatHTML(d.trangthai) + '</span>' : '<span class="m-val trong">—</span>'}</span>
      </div>
      ${hn}
      <div class="prog">
        <div class="prog-head"><span>Tiến độ (theo việc hoàn thành)</span><span class="pct">${pct}%</span></div>
        <div class="prog-track"><div class="prog-fill" style="width:${pct}%"></div><div class="prog-dash"></div></div>
      </div>
      <div class="tasks-summary">
        <span class="tasks-title">${sv} công việc</span>
        <button class="btn-kanban" type="button" data-mokanban="${thoatHTML(d.ma)}">Mở bảng công việc →</button>
      </div>
    </article>`;
  }).join('');
}

/* ====== KANBAN ====== */
function veKanban(){
  if(!madaKanbanHienTai) return;
  let viecAll = NHIEM_VU.filter(v => v.mada === madaKanbanHienTai);

  /* Sắp xếp */
  const sortMode = $('k-sort-select').value;
  if(sortMode === 'han-asc'){
    viecAll = [...viecAll].sort((a,b)=>{
      const da = docNgay(a.han), db = docNgay(b.han);
      return (da?da.getTime():Infinity) - (db?db.getTime():Infinity);
    });
  } else if(sortMode === 'uutien-desc'){
    const diem = v => { const k = boDau(v); return k.includes('cao') ? 3 : k.includes('thap') ? 1 : 2; };
    viecAll = [...viecAll].sort((a,b)=>diem(b.uutien) - diem(a.uutien));
  }

  /* Chip lọc — data-attribute, an toàn mọi ký tự */
  const dhm = [...new Set(viecAll.map(v => v.hangmuc).filter(Boolean))];
  const dng = [...new Set(viecAll.flatMap(v => v.nguoi.split(',').map(s=>s.trim())).filter(Boolean))];
  const chip = (loai, val, nhan, act) =>
    '<button class="k-chip' + (act ? ' active' : '') + '" data-kf="' + loai + '" data-kv="' + thoatHTML(val ?? '') + '">' + thoatHTML(nhan) + '</button>';
  $('k-filter-hm').innerHTML = '<span class="k-filter-lbl">Hạng mục:</span>'
    + chip('hangmuc','','Tất cả',!kFilter.hangmuc)
    + dhm.map(f=>chip('hangmuc',f,f,kFilter.hangmuc===f)).join('');
  $('k-filter-nguoi').innerHTML = '<span class="k-filter-lbl">Nhân sự:</span>'
    + chip('nguoi','','Tất cả',!kFilter.nguoi)
    + dng.map(f=>chip('nguoi',f,f,kFilter.nguoi===f)).join('');

  document.querySelectorAll('.kanban-col').forEach(col=>{
    const tt = col.dataset.cot;
    const ds = viecAll.filter(v => chuanCot(v.trangthai) === tt)
      .filter(v => (!kFilter.hangmuc || v.hangmuc === kFilter.hangmuc)
                && (!kFilter.nguoi || v.nguoi.split(',').map(s=>s.trim()).includes(kFilter.nguoi)));
    col.querySelector('.k-count').textContent = '(' + ds.length + ')';
    col.querySelector('.k-list').innerHTML = ds.map(v => {
      const pStyle = boDau(v.uutien).includes('cao') ? 'color:var(--red);font-weight:600' : boDau(v.uutien).includes('thap') ? 'color:var(--line)' : 'color:var(--concrete)';
      return `
      <div class="k-card${chonUids.has(v.uid) ? ' k-selected' : ''}" draggable="true" data-uid="${v.uid}">
        <div class="k-card-top">
          ${v.hangmuc ? '<span class="k-badge">' + thoatHTML(v.hangmuc) + '</span>' : '<span></span>'}
          <span class="k-prio" style="${pStyle}">${thoatHTML(v.uutien || '')}</span>
          <button class="k-more" type="button" data-kmore="${v.uid}" title="Sửa / Xóa">⋯</button>
        </div>
        <div class="k-card-title">${thoatHTML(v.nhiemvu)}</div>
        ${v.ghichu ? '<div class="k-note">' + thoatHTML(v.ghichu) + '</div>' : ''}
        <div class="k-card-meta">
          <span>👤 ${thoatHTML(v.nguoi)}</span>
          ${v.han && v.han !== '-' ? '<span style="color:var(--orange)">⏳ ' + thoatHTML(v.han) + '</span>' : ''}
        </div>
      </div>`;
    }).join('');
  });
}
const MSG_KANBAN_MACDINH = '💡 Chạm để chọn thẻ • Kéo thả nhiều thẻ cùng lúc • Chuột phải hoặc nút ⋯ để Sửa/Xóa';
function msgKanbanReset(tre){ setTimeout(()=>{ $('msgKanban').innerHTML = '<span style="color:var(--concrete)">' + MSG_KANBAN_MACDINH + '</span>'; }, tre || 3000); }

/* Chip lọc + sắp xếp */
document.querySelector('.kanban-tools').addEventListener('click', e=>{
  const c = e.target.closest('.k-chip');
  if(!c) return;
  kFilter[c.dataset.kf] = c.dataset.kv || null;
  veKanban();
});
$('k-sort-select').addEventListener('change', veKanban);

/* Chọn thẻ (giữ lựa chọn qua các lần vẽ lại nhờ chonUids) */
document.querySelector('.kanban-wrapper').addEventListener('click', e=>{
  if(e.target.closest('.k-more')) return;
  const card = e.target.closest('.k-card');
  if(!card) return;
  const uid = Number(card.dataset.uid);
  if(chonUids.has(uid)){ chonUids.delete(uid); card.classList.remove('k-selected'); }
  else { chonUids.add(uid); card.classList.add('k-selected'); }
});

/* Nút ⋯ trên thẻ — đường tắt Sửa/Xóa cho cả mobile (không có chuột phải) */
document.querySelector('.kanban-wrapper').addEventListener('click', e=>{
  const nut = e.target.closest('.k-more');
  if(!nut) return;
  e.stopPropagation();
  const uid = Number(nut.dataset.kmore);
  if(!chonUids.has(uid)){ chonUids.clear(); chonUids.add(uid); veKanban(); }
  ctxTaskUids = [...chonUids];
  const menu = $('taskContextMenu');
  const r = nut.getBoundingClientRect();
  menu.style.top = (r.bottom + window.scrollY + 4) + 'px';
  menu.style.left = Math.max(8, r.right + window.scrollX - 170) + 'px';
  menu.classList.add('show');
  $('ctx-t-edit').style.display = ctxTaskUids.length > 1 ? 'none' : 'flex';
});

/* Kéo thả — theo uid */
document.addEventListener('dragstart', e=>{
  const card = e.target.closest && e.target.closest('.k-card');
  if(!card) return;
  const uid = Number(card.dataset.uid);
  if(!chonUids.has(uid)){ chonUids.clear(); chonUids.add(uid); }
  keoUids = [...chonUids];
  if(e.dataTransfer) e.dataTransfer.setData('text/plain', String(uid));
  setTimeout(()=>{ document.querySelectorAll('.k-card.k-selected').forEach(c=>c.classList.add('k-dragging')); }, 0);
});
document.addEventListener('dragend', ()=>{
  document.querySelectorAll('.k-card.k-dragging').forEach(c=>c.classList.remove('k-dragging'));
});
document.querySelectorAll('.kanban-col').forEach(col=>{
  col.addEventListener('dragover', e=>e.preventDefault());
  col.addEventListener('drop', e=>{ e.preventDefault(); thaThe(col.dataset.cot); });
});

async function thaThe(trangThaiMoi){
  const uids = [...keoUids]; keoUids = [];
  if(!uids.length || !madaKanbanHienTai) return;
  const canDoi = uids.map(u => NHIEM_VU.find(v => v.uid === u))
                     .filter(v => v && chuanCot(v.trangthai) !== trangThaiMoi);
  if(!canDoi.length){ chonUids.clear(); veKanban(); return; }

  /* Lấy mã xác nhận TRƯỚC khi đổi giao diện */
  let mk = maXacNhanCache;
  if(!mk){
    mk = prompt('Di chuyển ' + canDoi.length + ' công việc. Nhập mã xác nhận của phòng:');
    if(!mk){ chonUids.clear(); veKanban(); return; }
  }

  /* Lưu trạng thái cũ để hoàn tác nếu lỗi */
  const cu = canDoi.map(v => ({uid: v.uid, tt: v.trangthai}));
  canDoi.forEach(v => v.trangthai = trangThaiMoi);
  chonUids.clear();
  veKanban();
  $('msgKanban').innerHTML = '<span style="color:var(--orange)">⏳ Đang lưu ' + canDoi.length + ' cập nhật lên Sheets...</span>';

  try{
    /* MỘT request hàng loạt — không còn race condition */
    const res = await fetch(LINK_APPS_SCRIPT, {
      method:'POST',
      body: JSON.stringify({ type:'sua_trangthai_nhiemvu', matkhau: mk,
        data:{ mada: madaKanbanHienTai, trangthai: trangThaiMoi,
               items: canDoi.map(v => ({nhiemvu: v.nhiemvu, nguoi: v.nguoi})) } })
    });
    const kq = await res.json();
    if(kq.ok){
      maXacNhanCache = mk; lanGhiCuoi = Date.now();
      $('msgKanban').innerHTML = '<span style="color:var(--green)">✔ Đã lưu ' + (kq.soluong ?? canDoi.length) + ' cập nhật!</span>';
      veDanhSach();
      msgKanbanReset();
    } else {
      throw new Error(kq.loi || 'Lỗi không xác định');
    }
  }catch(err){
    cu.forEach(c => { const v = NHIEM_VU.find(x=>x.uid===c.uid); if(v) v.trangthai = c.tt; });
    veKanban();
    baoToast('✖ ' + err.message, 'err');
    msgKanbanReset(100);
  }
}

/* ====== Menu chuột phải ====== */
document.addEventListener('contextmenu', e=>{
  const kCard = e.target.closest('.k-card');
  if(kCard){
    e.preventDefault(); e.stopPropagation();
    const uid = Number(kCard.dataset.uid);
    if(!chonUids.has(uid)){ chonUids.clear(); chonUids.add(uid); veKanban(); }
    ctxTaskUids = [...chonUids];
    const menu = $('taskContextMenu');
    menu.style.top = e.pageY + 'px'; menu.style.left = e.pageX + 'px';
    menu.classList.add('show');
    $('ctx-t-edit').style.display = ctxTaskUids.length > 1 ? 'none' : 'flex';
    return;
  }
  const pCard = e.target.closest('.card');
  if(pCard){
    e.preventDefault(); e.stopPropagation();
    ctxProjectMa = pCard.dataset.ma;
    const d = DU_AN.find(x => x.ma === ctxProjectMa);
    const menu = $('projectContextMenu');
    menu.style.top = e.pageY + 'px'; menu.style.left = e.pageX + 'px';
    menu.classList.add('show');
    $('ctx-p-portal').style.display = (d && d.link && d.link !== '#' && d.link !== '-') ? 'flex' : 'none';
  }
});
document.addEventListener('click', e=>{
  if(!e.target.closest('.context-menu')) dongCtx();
});

/* --- Menu dự án --- */
$('ctx-p-portal').onclick = () => {
  dongCtx();
  const d = DU_AN.find(x => x.ma === ctxProjectMa);
  if(d) window.open(d.link, '_blank', 'noopener');
};
$('ctx-p-edit').onclick = () => {
  dongCtx();
  const d = DU_AN.find(x => x.ma === ctxProjectMa); if(!d) return;
  maDangSua = d.ma;
  $('tieuDeFormDA').textContent = '✎ Chỉnh sửa: ' + d.ma;
  $('guiDuAn').textContent = 'Lưu thay đổi';
  $('da-ma').value = d.ma; $('da-ten').value = d.ten; $('da-loai').value = d.loai;
  $('da-giaidoan').value = d.giaidoan; $('da-vaitro').value = d.vaitro;
  setMultiSelect('da-phutrach', d.phutrach);
  $('da-trangthai').value = d.trangthai || 'Đang triển khai';
  const fp = document.querySelector('#da-hannop')._flatpickr;
  if(fp) fp.setDate(d.hannop === '-' ? '' : d.hannop, false, 'd/m/Y'); else $('da-hannop').value = d.hannop === '-' ? '' : d.hannop;
  $('da-link').value = (d.link === '-' || d.link === '#') ? '' : d.link;
  $('da-matkhau').value = maXacNhanCache;
  $('msgDuAn').textContent = '';
  moOverlay('modalDuAn');
};
$('ctx-p-del').onclick = async () => {
  dongCtx();
  const ma = ctxProjectMa; if(!ma) return;
  let mk = maXacNhanCache || prompt('Nhập mã xác nhận của phòng để XÓA dự án:');
  if(!mk) return;
  if(!confirm('Xóa hẳn dự án "' + ma + '" khỏi Sheets?\nHành động này không thể hoàn tác!')) return;
  baoToast('⏳ Đang xóa dự án...');
  try{
    const res = await fetch(LINK_APPS_SCRIPT, {
      method:'POST', body: JSON.stringify({ type:'xoaduan', matkhau: mk, data:{ magoc: ma } })
    });
    const kq = await res.json();
    if(kq.ok){
      maXacNhanCache = mk; lanGhiCuoi = Date.now();
      DU_AN = DU_AN.filter(d => d.ma !== ma);
      NHIEM_VU = NHIEM_VU.filter(v => v.mada !== ma);   /* dọn cả việc của dự án */
      veDanhSach(); dungBoLoc();
      baoToast('✔ Đã xóa dự án ' + ma, 'ok');
    } else {
      baoToast('✖ ' + (kq.loi || 'Không xóa được'), 'err');
    }
  }catch(err){ baoToast('✖ Không gửi được: ' + err.message, 'err'); }
};

/* --- Menu công việc --- */
$('ctx-t-edit').onclick = () => {
  dongCtx();
  if(ctxTaskUids.length !== 1) return;
  const nv = NHIEM_VU.find(v => v.uid === ctxTaskUids[0]); if(!nv) return;
  uidDangSua = nv.uid;
  $('tieuDeFormCV').textContent = '✎ Chỉnh sửa công việc';
  $('guiViec').textContent = 'Lưu cập nhật';
  $('cv-mada').value = nv.mada;
  $('cv-hangmuc').value = nv.hangmuc || '';
  $('cv-nhiemvu').value = nv.nhiemvu;
  setMultiSelect('cv-nguoi', nv.nguoi);
  $('cv-uutien').value = ['Cao','Trung bình','Thấp'].includes(nv.uutien) ? nv.uutien : 'Trung bình';
  const fp = document.querySelector('#cv-han')._flatpickr;
  if(fp) fp.setDate(nv.han === '-' ? '' : nv.han, false, 'd/m/Y'); else $('cv-han').value = nv.han === '-' ? '' : nv.han;
  $('cv-trangthai').value = chuanCot(nv.trangthai);
  $('cv-ghichu').value = nv.ghichu || '';
  $('cv-matkhau').value = maXacNhanCache;
  $('msgViec').textContent = '';
  moOverlay('modalViec');
};
$('ctx-t-del').onclick = async () => {
  dongCtx();
  if(!ctxTaskUids.length) return;
  const items = ctxTaskUids.map(u => NHIEM_VU.find(v => v.uid === u)).filter(Boolean);
  if(!items.length) return;
  let mk = maXacNhanCache || prompt('XÓA ' + items.length + ' công việc.\nNhập mã xác nhận của phòng:');
  if(!mk) return;
  if(!confirm('Xóa vĩnh viễn ' + items.length + ' công việc này khỏi Sheets?')) return;
  $('msgKanban').innerHTML = '<span style="color:var(--orange)">⏳ Đang xóa...</span>';
  try{
    /* MỘT request — script xóa từ dưới lên, không lệch dòng */
    const res = await fetch(LINK_APPS_SCRIPT, {
      method:'POST',
      body: JSON.stringify({ type:'xoanhiemvu', matkhau: mk,
        data:{ mada: madaKanbanHienTai, items: items.map(v => ({nhiemvu: v.nhiemvu, nguoi: v.nguoi})) } })
    });
    const kq = await res.json();
    if(kq.ok){
      maXacNhanCache = mk; lanGhiCuoi = Date.now();
      const xoaUids = new Set(items.map(v=>v.uid));
      NHIEM_VU = NHIEM_VU.filter(v => !xoaUids.has(v.uid));
      chonUids.clear();
      veKanban(); veDanhSach();
      $('msgKanban').innerHTML = '<span style="color:var(--green)">✔ Đã xóa ' + (kq.soluong ?? items.length) + ' việc!</span>';
      msgKanbanReset();
    } else {
      $('msgKanban').innerHTML = '';
      baoToast('✖ ' + (kq.loi || 'Không xóa được'), 'err');
      msgKanbanReset(100);
    }
  }catch(err){
    baoToast('✖ Không gửi được: ' + err.message, 'err');
    msgKanbanReset(100);
  }
};

/* ====== Gửi dữ liệu (dùng chung cho form) ====== */
async function guiLenSheets(type, data, matkhau, msgEl, nutEl){
  msgEl.className = 'modal-msg'; msgEl.textContent = 'Đang ghi...';
  nutEl.disabled = true;
  try{
    const res = await fetch(LINK_APPS_SCRIPT, { method:'POST', body: JSON.stringify({type, matkhau, data}) });
    const kq = await res.json();
    if(kq.ok){ msgEl.className = 'modal-msg ok'; return true; }
    msgEl.className = 'modal-msg err';
    msgEl.textContent = '✖ ' + (kq.loi || 'Lỗi không xác định');
    return false;
  }catch(err){
    msgEl.className = 'modal-msg err';
    msgEl.textContent = '✖ Không gửi được: ' + err.message;
    return false;
  }finally{ nutEl.disabled = false; }
}

/* ====== Đóng modal ====== */
document.querySelectorAll('[data-dong]').forEach(b=>{
  b.addEventListener('click', e=>{ e.target.closest('.modal-overlay').hidden = true; moCuonNeuHetModal(); });
});
document.querySelectorAll('.modal-overlay').forEach(ov=>{
  ov.addEventListener('click', e=>{ if(e.target===ov){ ov.hidden = true; moCuonNeuHetModal(); } });
});

/* ====== Multi-select nhân sự (khôi phục) ====== */
function taoMultiSelect(containerId, inputId){
  const c = $(containerId);
  if(!c) return;
  let html = '<div class="ms-header"><span id="' + inputId + '-text" style="opacity:0.6">Chọn nhân sự...</span> <span style="font-size:10px">▼</span></div><div class="ms-options">';
  DANH_SACH_NHAN_SU.forEach(name => {
    html += '<label><input type="checkbox" value="' + thoatHTML(name) + '" class="' + inputId + '-cb"> ' + thoatHTML(name) + '</label>';
  });
  html += '</div><input type="hidden" id="' + inputId + '">';
  c.innerHTML = html;
  c.querySelector('.ms-header').addEventListener('click', function(){ this.nextElementSibling.classList.toggle('open'); });
  const cbs = c.querySelectorAll('.' + inputId + '-cb');
  cbs.forEach(cb => cb.addEventListener('change', () => {
    const sel = Array.from(cbs).filter(x => x.checked).map(x => x.value);
    $(inputId).value = sel.join(', ');
    $(inputId + '-text').textContent = sel.length ? sel.join(', ') : 'Chọn nhân sự...';
    $(inputId + '-text').style.opacity = sel.length ? '1' : '0.6';
  }));
}
function setMultiSelect(inputId, valString){
  const vals = (valString || '').split(',').map(s=>s.trim());
  const cbs = document.querySelectorAll('.' + inputId + '-cb');
  cbs.forEach(cb => cb.checked = vals.includes(cb.value));
  const sel = Array.from(cbs).filter(x => x.checked).map(x => x.value);
  $(inputId).value = sel.join(', ');
  const txt = $(inputId + '-text');
  if(txt){
    txt.textContent = sel.length ? sel.join(', ') : 'Chọn nhân sự...';
    txt.style.opacity = sel.length ? '1' : '0.6';
  }
}
document.addEventListener('click', e=>{
  document.querySelectorAll('.ms-wrapper').forEach(w=>{
    if(!w.contains(e.target)){
      const opt = w.querySelector('.ms-options');
      if(opt) opt.classList.remove('open');
    }
  });
});

/* ====== Nút & form ====== */
$('luoiDuAn').addEventListener('click', e=>{
  const nutKanban = e.target.closest('[data-mokanban]');
  if(!nutKanban) return;
  madaKanbanHienTai = nutKanban.dataset.mokanban;
  $('kanbanTitle').textContent = 'BẢNG CÔNG VIỆC: ' + madaKanbanHienTai;
  kFilter = { hangmuc: null, nguoi: null };
  chonUids.clear();
  $('k-sort-select').value = 'macdinh';
  veKanban();
  moOverlay('modalKanban');
});

$('nutThemDuAn').addEventListener('click', ()=>{
  maDangSua = null;
  $('tieuDeFormDA').textContent = '➕ Thêm dự án mới';
  $('guiDuAn').textContent = 'Ghi vào Sheets';
  ['da-ma','da-ten','da-loai','da-giaidoan','da-vaitro','da-link'].forEach(id=>$(id).value='');
  const fp = document.querySelector('#da-hannop')._flatpickr; if(fp) fp.clear(); else $('da-hannop').value = '';
  setMultiSelect('da-phutrach', '');
  $('da-matkhau').value = maXacNhanCache;
  $('msgDuAn').textContent = '';
  moOverlay('modalDuAn');
});

$('btnGiaoViecKanban').addEventListener('click', ()=>{
  uidDangSua = null;
  $('tieuDeFormCV').textContent = '🗒 Khai báo công việc';
  $('guiViec').textContent = 'Ghi vào Sheets';
  $('cv-mada').value = madaKanbanHienTai || '';
  ['cv-hangmuc','cv-nhiemvu','cv-ghichu'].forEach(id=>$(id).value='');
  $('cv-uutien').value = 'Trung bình';
  $('cv-trangthai').value = 'Chưa bắt đầu';
  const fp = document.querySelector('#cv-han')._flatpickr; if(fp) fp.clear(); else $('cv-han').value = '';
  setMultiSelect('cv-nguoi', '');
  $('cv-matkhau').value = maXacNhanCache;
  $('msgViec').textContent = '';
  moOverlay('modalViec');
});

$('guiDuAn').addEventListener('click', async ()=>{
  const v = id => $(id).value.trim();
  const msg = $('msgDuAn');
  if(!v('da-ma') || !v('da-ten') || !v('da-phutrach')){ msg.className='modal-msg err'; msg.textContent='✖ Điền đủ Mã, Tên, Phụ trách'; return; }
  if(!v('da-matkhau')){ msg.className='modal-msg err'; msg.textContent='✖ Nhập mã xác nhận của phòng'; return; }
  const duLieu = {
    magoc: maDangSua || '',
    ma:v('da-ma'), ten:v('da-ten'), loai:v('da-loai'), giaidoan:v('da-giaidoan'),
    vaitro:v('da-vaitro'), tiendo: tinhTienDo(maDangSua || v('da-ma')),
    phutrach:v('da-phutrach'), trangthai:v('da-trangthai'), hannop:v('da-hannop')||'-', link:v('da-link')||'-'
  };
  const ok = await guiLenSheets(maDangSua ? 'suaduan' : 'duan', duLieu, v('da-matkhau'), msg, $('guiDuAn'));
  if(ok){
    maXacNhanCache = v('da-matkhau'); lanGhiCuoi = Date.now();
    const moi = {...duLieu}; delete moi.magoc;
    if(maDangSua){
      const i = DU_AN.findIndex(d => d.ma === maDangSua);
      if(i > -1){
        DU_AN[i] = moi;
        if(maDangSua !== moi.ma) NHIEM_VU.forEach(x=>{ if(x.mada===maDangSua) x.mada = moi.ma; });
      }
      msg.textContent = '✔ Đã lưu!';
      setTimeout(()=>{ $('modalDuAn').hidden = true; moCuonNeuHetModal(); }, 900);
    } else {
      DU_AN.push(moi);
      msg.textContent = '✔ Đã thêm!';
      ['da-ma','da-ten','da-giaidoan','da-link'].forEach(id=>$(id).value='');
      const fp = document.querySelector('#da-hannop')._flatpickr; if(fp) fp.clear();
      setMultiSelect('da-phutrach', '');
    }
    veDanhSach(); dungBoLoc();
  }
});

$('guiViec').addEventListener('click', async ()=>{
  const v = id => $(id).value.trim();
  const msg = $('msgViec');
  if(!v('cv-mada')){ msg.className='modal-msg err'; msg.textContent='✖ Thiếu mã dự án — đóng form và mở lại từ bảng công việc'; return; }
  if(!v('cv-nhiemvu') || !v('cv-nguoi')){ msg.className='modal-msg err'; msg.textContent='✖ Điền đủ Nội dung và Người thực hiện'; return; }
  if(!v('cv-matkhau')){ msg.className='modal-msg err'; msg.textContent='✖ Nhập mã xác nhận của phòng'; return; }

  const nvGoc = uidDangSua ? NHIEM_VU.find(x => x.uid === uidDangSua) : null;
  const duLieuViec = {
    mada:v('cv-mada'), hangmuc:v('cv-hangmuc'), nhiemvu:v('cv-nhiemvu'), nguoi:v('cv-nguoi'),
    uutien:v('cv-uutien'), han:v('cv-han')||'-', trangthai:v('cv-trangthai'), ghichu:v('cv-ghichu')
  };
  if(nvGoc){
    duLieuViec.magoc = nvGoc.mada;
    duLieuViec.nvgoc = nvGoc.nhiemvu;
    duLieuViec.nguoigoc = nvGoc.nguoi;   /* chống sửa nhầm việc trùng tên */
  }
  const ok = await guiLenSheets(nvGoc ? 'suanhiemvu' : 'nhiemvu', duLieuViec, v('cv-matkhau'), msg, $('guiViec'));
  if(ok){
    maXacNhanCache = v('cv-matkhau'); lanGhiCuoi = Date.now();
    if(nvGoc){
      const giuUid = nvGoc.uid;
      Object.assign(nvGoc, duLieuViec, {uid: giuUid});
      msg.textContent = '✔ Đã lưu!';
      setTimeout(()=>{ $('modalViec').hidden = true; moCuonNeuHetModal(); }, 900);
    } else {
      NHIEM_VU.push({ uid: ++demUid, ...duLieuViec });
      msg.textContent = '✔ Đã giao việc!';
      ['cv-hangmuc','cv-nhiemvu','cv-ghichu'].forEach(id=>$(id).value='');
      const fp = document.querySelector('#cv-han')._flatpickr; if(fp) fp.clear();
      setMultiSelect('cv-nguoi', '');
    }
    veDanhSach();
    if(!$('modalKanban').hidden) veKanban();
  }
});

/* ====== Bộ lọc & khởi tạo ====== */
$('oTimKiem').addEventListener('input', veDanhSach);
['locLoai','locGiaiDoan','locTrangThai','sapXep'].forEach(id=>$(id).addEventListener('change', veDanhSach));
$('nutLamMoi').addEventListener('click', taiDuLieu);

taoMultiSelect('ms-phutrach-container', 'da-phutrach');
taoMultiSelect('ms-nguoi-container', 'cv-nguoi');

try{
  const fpConfig = {
    locale: 'vn', dateFormat: 'd/m/Y', allowInput: true,
    onReady: function(dObj, dStr, fp){
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'flatpickr-today-btn'; btn.textContent = '🎯 Chọn hôm nay';
      btn.onclick = function(){ fp.setDate(new Date()); fp.close(); };
      fp.calendarContainer.appendChild(btn);
    }
  };
  flatpickr('#da-hannop', fpConfig);
  flatpickr('#cv-han', fpConfig);
}catch(e){ /* thiếu CDN thì gõ tay dd/mm/yyyy vẫn dùng được */ }

try{
  MobileDragDrop.polyfill({ dragImageTranslateOverride: MobileDragDrop.scrollBehaviourDragImageTranslateOverride });
  window.addEventListener('touchmove', function(){}, {passive:false});
}catch(e){ /* mobile dùng nút ⋯ thay kéo thả */ }

try{
  const sw = $('checkboxTheme');
  if(localStorage.getItem('theme') === 'dark'){ document.documentElement.setAttribute('data-theme','dark'); sw.checked = true; }
  sw.addEventListener('change', e=>{
    const t = e.target.checked ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', t);
    try{ localStorage.setItem('theme', t); }catch(x){}
  });
}catch(x){}

taiDuLieu();
setInterval(()=>{ if(Date.now() - lanGhiCuoi > 6*60*1000) taiDuLieu(); }, 5*60*1000);

/* ====== Sân chơi 7 người que (trang trí) ====== */
(function taoNguoiQue(){
  const san = document.getElementById('sanChoi');
  if(!san) return;
  const mau = ['#E85D04','#1D4ED8','#1E6B33','#B45309','#9A3B00','#6B7280','#B91C1C'];
  /* lấy tên cuối cho gọn: "Phạm Anh Khoa" -> "Khoa" */
  const ten = (DANH_SACH_NHAN_SU || []).slice(0, 7).map(t => {
    const p = String(t).trim().split(/\s+/); return p[p.length - 1] || t;
  });
  while(ten.length < 7) ten.push('Bạn ' + (ten.length + 1));

  const nguoiQueSVG = c => `
    <svg viewBox="0 0 26 46">
      <circle cx="13" cy="8" r="6" fill="none" stroke="${c}" stroke-width="2.5"/>
      <line x1="13" y1="14" x2="13" y2="30" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
      <g class="tay-t"><line x1="0" y1="0" x2="-7" y2="9" transform="translate(13 18)" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/></g>
      <g class="tay-p"><line x1="0" y1="0" x2="7" y2="9" transform="translate(13 18)" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/></g>
      <g class="chan-t"><line x1="0" y1="0" x2="-7" y2="14" transform="translate(13 30)" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/></g>
      <g class="chan-p"><line x1="0" y1="0" x2="7" y2="14" transform="translate(13 30)" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/></g>
    </svg>`;

  san.innerHTML = ten.map((t, i) =>
    `<div class="nq nq${i+1}"><span class="ten">${thoatHTML(t)}</span>${nguoiQueSVG(mau[i])}</div>`
  ).join('');
})();
