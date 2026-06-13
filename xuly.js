/* ====== Trạng thái toàn cục ====== */
let DU_AN = [];
let NHIEM_VU = [];
let maXacNhanCache = '';
/* Mã xác nhận nhớ trong phiên; tự xóa sau 30 phút KHÔNG hoạt động (hoặc khi tải lại trang) */
let _henXoaMa = null;
function nhoMaTrongPhien(mk){
  maXacNhanCache = mk;
  if(_henXoaMa) clearTimeout(_henXoaMa);
}
function chamHoatDong(){
  if(!maXacNhanCache) return;
  if(_henXoaMa) clearTimeout(_henXoaMa);
  _henXoaMa = setTimeout(()=>{ maXacNhanCache=''; }, 30*60*1000);
}
['pointerdown','keydown'].forEach(ev=>document.addEventListener(ev, chamHoatDong, {passive:true}));
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
$('tenDonVi').textContent = TEN_DON_VI + (typeof TRUONG_NHOM!=='undefined' && TRUONG_NHOM ? '  ·  Trưởng nhóm: ' + TRUONG_NHOM : '');
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
  const tong = viec.reduce((s,v)=>s+pctTrangThai(v.trangthai),0);
  return Math.round(tong / viec.length);
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
    phancap: o['phan cap'] || o['phancap'] || o['phan loai chi tiet'] || '',
    hangmuc: o['hang muc'] || o['hangmuc'] || o['phan loai'] || '',
    nhiemvu: o['nhiem vu'] || o['nhiemvu'] || o['noi dung cong viec'] || o['noi dung'] || '',
    nguoi: o['nguoi thuc hien'] || o['nguoi'] || o['nhan su'] || '',
    uutien: o['uu tien'] || o['uutien'] || '',
    han: o['han'] || o['han nop'] || o['deadline'] || '',
    trangthai: o['trang thai'] || 'Chưa bắt đầu',
    ghichu: o['ghi chu'] || o['ghichu'] || '',
    vuongmac: o['vuong mac'] || o['vuongmac'] || o['vuong mac / kho khan'] || ''
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
    veViewPhu();
    if(!taiDuLieu._daTuChuyen){
      taiDuLieu._daTuChuyen = true;
      if(nguoiCuaToi) doiView('toi');   /* thành viên: vào thẳng việc của mình */
    }
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
  if(typeof veCanhBao === 'function') veCanhBao();
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
          ${v.phancap ? '<span class="k-badge">' + thoatHTML(v.phancap) + '</span>' : (v.hangmuc ? '<span class="k-badge">' + thoatHTML(v.hangmuc) + '</span>' : '<span></span>')}
          <span class="k-prio" style="${pStyle}">${thoatHTML(v.uutien || '')}</span>
          <button class="k-more" type="button" data-kmore="${v.uid}" title="Sửa / Xóa">⋯</button>
        </div>
        <div class="k-card-title">${thoatHTML(v.nhiemvu || tachCap(v.phancap).slice(-1)[0] || '(việc chưa đặt tên)')}</div>
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
               items: canDoi.map(v => ({nhiemvu: v.nhiemvu, nguoi: v.nguoi, phancap: v.phancap})) } })
    });
    const kq = await res.json();
    if(kq.ok){
      nhoMaTrongPhien(mk); chamHoatDong(); lanGhiCuoi = Date.now();
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
  const ttEl = e.target.closest('[data-ttpick]');
  if(ttEl){
    e.preventDefault(); e.stopPropagation();
    moMenuTrangThai(Number(ttEl.dataset.ttpick), e.clientX, e.clientY);
    return;
  }
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
      nhoMaTrongPhien(mk); chamHoatDong(); lanGhiCuoi = Date.now();
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
function moFormSuaViec(uid){
  const nv = NHIEM_VU.find(v => v.uid === uid); if(!nv) return;
  uidDangSua = nv.uid;
  $('tieuDeFormCV').textContent = '✎ Chỉnh sửa công việc';
  $('guiViec').textContent = 'Lưu cập nhật';
  $('cv-mada').value = nv.mada;
  $('cv-phancap').value = nv.phancap || '';
  $('cv-nhiemvu').value = nv.nhiemvu;
  setMultiSelect('cv-nguoi', nv.nguoi);
  $('cv-uutien').value = ['Cao','Trung bình','Thấp'].includes(nv.uutien) ? nv.uutien : 'Trung bình';
  const fp = document.querySelector('#cv-han')._flatpickr;
  if(fp) fp.setDate(nv.han === '-' ? '' : nv.han, false, 'd/m/Y'); else $('cv-han').value = nv.han === '-' ? '' : nv.han;
  $('cv-trangthai').value = chuanCot(nv.trangthai);
  $('cv-ghichu').value = nv.ghichu || '';
  $('cv-vuongmac').value = nv.vuongmac || '';
  $('cv-matkhau').value = maXacNhanCache;
  $('msgViec').textContent = '';
  moOverlay('modalViec');
}
$('ctx-t-edit').onclick = () => {
  dongCtx();
  if(ctxTaskUids.length !== 1) return;
  moFormSuaViec(ctxTaskUids[0]);
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
        data:{ mada: madaKanbanHienTai, items: items.map(v => ({nhiemvu: v.nhiemvu, nguoi: v.nguoi, phancap: v.phancap})) } })
    });
    const kq = await res.json();
    if(kq.ok){
      nhoMaTrongPhien(mk); chamHoatDong(); lanGhiCuoi = Date.now();
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
  ['cv-phancap','cv-nhiemvu','cv-ghichu','cv-vuongmac'].forEach(id=>$(id).value='');
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
  if((!v('cv-phancap') && !v('cv-nhiemvu')) || !v('cv-nguoi')){ msg.className='modal-msg err'; msg.textContent='✖ Cần Phân cấp (hoặc Nội dung) và Người thực hiện'; return; }
  if(!v('cv-matkhau')){ msg.className='modal-msg err'; msg.textContent='✖ Nhập mã xác nhận của phòng'; return; }

  const nvGoc = uidDangSua ? NHIEM_VU.find(x => x.uid === uidDangSua) : null;
  const duLieuViec = {
    mada:v('cv-mada'), phancap:v('cv-phancap'), hangmuc:(nvGoc?(nvGoc.hangmuc||''):''), nhiemvu:v('cv-nhiemvu'), nguoi:v('cv-nguoi'),
    uutien:v('cv-uutien'), han:v('cv-han')||'-', trangthai:v('cv-trangthai'), ghichu:v('cv-ghichu'), vuongmac:v('cv-vuongmac')
  };
  if(nvGoc){
    duLieuViec.magoc = nvGoc.mada;
    duLieuViec.nvgoc = nvGoc.nhiemvu;
    duLieuViec.nguoigoc = nvGoc.nguoi;   /* chống sửa nhầm việc trùng tên */
    duLieuViec.phancapgoc = nvGoc.phancap || '';
  }
  const ok = await guiLenSheets(nvGoc ? 'suanhiemvu' : 'nhiemvu', duLieuViec, v('cv-matkhau'), msg, $('guiViec'));
  if(ok){
    nhoMaTrongPhien(v('cv-matkhau')); chamHoatDong(); lanGhiCuoi = Date.now();
    if(nvGoc){
      const giuUid = nvGoc.uid;
      Object.assign(nvGoc, duLieuViec, {uid: giuUid});
      msg.textContent = '✔ Đã lưu!';
      setTimeout(()=>{ $('modalViec').hidden = true; moCuonNeuHetModal(); }, 900);
    } else {
      NHIEM_VU.push({ uid: ++demUid, ...duLieuViec });
      msg.textContent = '✔ Đã giao việc!';
      ['cv-phancap','cv-nhiemvu','cv-ghichu','cv-vuongmac'].forEach(id=>$(id).value='');
      const fp = document.querySelector('#cv-han')._flatpickr; if(fp) fp.clear();
      setMultiSelect('cv-nguoi', '');
    }
    veDanhSach();
    if(!$('modalKanban').hidden) veKanban();
    veViewPhu();
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


/* ============================================================
   MÀN HÌNH PHỤ: "Bảng tổng hợp" (cây phân cấp) & "Việc của tôi"
   ============================================================ */
let viewHienTai = 'duan';                 /* duan | tonghop | toi */
let nguoiCuaToi = '';                     /* tên đang lọc ở "Việc của tôi" */
const moNhanh = new Set();                /* các nhánh đang mở trong cây */
try{ nguoiCuaToi = localStorage.getItem('nguoiCuaToi') || ''; }catch(e){}

/* % theo trạng thái 1 việc */
function pctTrangThai(tt){
  const c = chuanCot(tt);
  if(c === 'Hoàn thành') return 100;
  if(c === 'Trình duyệt KCS / TT') return 90;
  if(c === 'Đang thực hiện / Chỉnh sửa') return 50;
  return 0;   /* chưa bắt đầu */
}
function mauPct(p){ return p>=100 ? 'var(--green)' : p>0 ? 'var(--amber)' : 'var(--concrete)'; }

/* Chuyển màn hình */
function doiView(v){
  viewHienTai = v;
  document.querySelectorAll('.view-tab').forEach(b=>b.classList.toggle('active', b.dataset.view===v));
  $('luoiDuAn').style.display      = v==='duan' ? '' : 'none';
  $('thongBaoTrong').style.display = v==='duan' ? '' : 'none';
  $('thanhCongCu').style.display   = v==='duan' ? '' : 'none';
  $('viewTongHop').hidden = v!=='tonghop';
  $('viewToi').hidden     = v!=='toi';
  veViewPhu();
}
function veViewPhu(){
  if(viewHienTai==='tonghop') veTongHop();
  else if(viewHienTai==='toi') veViecCuaToi();
}

/* ---------- BẢNG TỔNG HỢP (cây) ----------
   - Phân cấp chia bằng dấu "/" → các cấp của cây.
   - Nội dung công việc (nhiemvu) KHÔNG phải một cấp; chỉ là ghi chú tùy chọn
     gắn vào nút cuối cùng của đường dẫn phân cấp.
   - Mỗi việc gắn vào node ở cuối đường dẫn (node.viec). Việc không có phân cấp
     gắn thẳng dưới mã dự án (nhóm "Chưa phân loại" hiển thị bằng tên việc nếu có). */
function tachCap(s){ return String(s||'').split('/').map(x=>x.trim()).filter(Boolean); }
function dungCay(){
  const root = {ten:'', con:new Map(), viec:[], key:''};
  NHIEM_VU.forEach(v=>{
    const segs = [v.mada].concat(tachCap(v.phancap));
    let node = root, key='';
    segs.forEach(seg=>{
      key += '/' + seg;
      if(!node.con.has(seg)) node.con.set(seg, {ten:seg, con:new Map(), viec:[], key:key});
      node = node.con.get(seg);
    });
    node.viec.push(v);           /* gắn việc vào node cuối đường dẫn */
  });
  return root;
}
/* tất cả việc nằm trong 1 nhánh (kể cả con cháu) */
function viecCuaNhanh(node){
  let arr = node.viec.slice();
  node.con.forEach(c=> arr = arr.concat(viecCuaNhanh(c)));
  return arr;
}
function pctCay(node){
  const vs = viecCuaNhanh(node);
  if(!vs.length) return 0;
  return Math.round(vs.reduce((s,v)=>s+pctTrangThai(v.trangthai),0) / vs.length);
}
function nhanhKhop(node, fNguoi, fText){
  return viecCuaNhanh(node).some(v=>vietKhop(v, fNguoi, fText));
}
function vietKhop(v, fNguoi, fText){
  if(window._anXongCay && chuanCot(v.trangthai)==='Hoàn thành') return false;
  const okN = !fNguoi || v.nguoi.split(',').map(s=>s.trim()).includes(fNguoi);
  const okT = !fText || boDau(v.mada+' '+(v.phancap||'')+' '+v.nhiemvu+' '+v.nguoi).includes(fText);
  return okN && okT;
}
function veTongHop(){
  const fNguoi = $('thNguoi').value;
  const fText = boDau($('thTim').value);
  window._anXongCay = $('thAnXong') && $('thAnXong').checked;
  const root = dungCay();
  if(!veTongHop._seeded && root.con.size){
    root.con.forEach(c=>moNhanh.add(c.key));   /* mở sẵn các dự án cấp 1 */
    veTongHop._seeded = true;
  }
  const out = [];

  function dongLa(ten, v, depth){
    const p = pctTrangThai(v.trangthai);
    const pad = 10 + depth*18;
    const ghichu = (v.nhiemvu && v.nhiemvu!==ten) ? '<span class="th-note">'+thoatHTML(v.nhiemvu)+'</span>' : '';
    const vm = v.vuongmac ? '<span class="th-vm" title="'+thoatHTML(v.vuongmac)+'">⚠</span>' : '';
    return '<div class="th-row th-leaf'+(v.vuongmac?' co-vm':'')+'" data-cbuid="'+v.uid+'">'
      + '<span class="th-ten" style="padding-left:'+pad+'px"><span class="th-ico"></span>'+vm+thoatHTML(ten)+ghichu+'</span>'
      + '<span class="th-c-tt" data-ttpick="'+v.uid+'" title="Bấm để đổi trạng thái">'+chipTrangThaiNho(v.trangthai)+'</span>'
      + '<span class="th-c-ng">'+thoatHTML(v.nguoi)+'</span>'
      + '<span class="th-c-pct"><span class="th-bar"><span class="th-fill" style="width:'+p+'%;background:'+mauPct(p)+'"></span></span><span class="th-pct" style="color:'+mauPct(p)+'">'+p+'%</span></span></div>';
  }
  function dongNhanh(c, depth){
    const p = pctCay(c);
    const pad = 10 + depth*18;
    const soViec = viecCuaNhanh(c).length;
    return '<div class="th-row th-br'+(depth===0?' th-lv0':'')+'" data-mo="'+thoatHTML(c.key)+'">'
      + '<span class="th-ten" style="padding-left:'+pad+'px;font-weight:600"><span class="th-ico">▸</span>'+thoatHTML(c.ten)+'</span>'
      + '<span class="th-c-tt"></span>'
      + '<span class="th-c-ng th-dem">'+soViec+' việc</span>'
      + '<span class="th-c-pct"><span class="th-bar"><span class="th-fill" style="width:'+p+'%;background:'+mauPct(p)+'"></span></span><span class="th-pct" style="color:'+mauPct(p)+'">'+p+'%</span></span></div>';
  }
  function walk(node, depth){
    [...node.con.values()].forEach(c=>{
      if(!nhanhKhop(c, fNguoi, fText)) return;
      const soCon = c.con.size;
      const soViec = c.viec.length;
      /* Lá thuần: không có nhánh con, đúng 1 việc → hiện tên cấp + trạng thái */
      if(soCon===0 && soViec===1){
        if(vietKhop(c.viec[0], fNguoi, fText)) out.push(dongLa(c.ten, c.viec[0], depth));
        return;
      }
      /* Nhánh: có con, hoặc nhiều việc cùng cấp */
      out.push(dongNhanh(c, depth));
      const dangLoc = !!(fNguoi || fText);
      if(moNhanh.has(c.key) || dangLoc){
        walk(c, depth+1);                                   /* nhánh con */
        c.viec.forEach(v=>{                                 /* việc gắn trực tiếp ở cấp này */
          if(vietKhop(v, fNguoi, fText))
            out.push(dongLa(v.nhiemvu || '(việc chưa đặt tên)', v, depth+1));
        });
      }
    });
  }
  walk(root, 0);
  $('thCay').innerHTML = out.join('') || '<div class="th-empty">Chưa có công việc nào khớp.</div>';
  $('thCay').querySelectorAll('.th-br').forEach(r=>{
    const ico = r.querySelector('.th-ico');
    if(ico) ico.textContent = (moNhanh.has(r.dataset.mo) || !!($('thNguoi').value || $('thTim').value)) ? '▾' : '▸';
  });
  if($('thNguoi').dataset.loaded !== '1'){
    const ds = [...new Set(NHIEM_VU.flatMap(v=>v.nguoi.split(',').map(s=>s.trim())).filter(Boolean))].sort();
    ds.forEach(n=>$('thNguoi').add(new Option(n,n)));
    $('thNguoi').dataset.loaded = '1';
  }
}
function chipTrangThaiNho(tt){
  const c = chuanCot(tt);
  let col='var(--concrete)', t='Chưa';
  if(c==='Hoàn thành'){ col='var(--green)'; t='Xong'; }
  else if(c==='Trình duyệt KCS / TT'){ col='var(--orange)'; t='Duyệt'; }
  else if(c==='Đang thực hiện / Chỉnh sửa'){ col='var(--amber)'; t='Đang'; }
  return '<span class="th-chip" style="color:'+col+';border-color:'+col+'">'+t+'</span>';
}
$('thCay').addEventListener('click', e=>{
  const r = e.target.closest('.th-br'); if(!r) return;   /* chỉ gập/mở nhánh — tab quan sát */
  const k = r.dataset.mo;
  if(moNhanh.has(k)) moNhanh.delete(k); else moNhanh.add(k);
  veTongHop();
});
$('thTim').addEventListener('input', veTongHop);
$('thNguoi').addEventListener('change', veTongHop);
$('thMoTatCa').addEventListener('click', ()=>{
  (function w(n){ n.con.forEach(c=>{ if(c.con.size || c.viec.length>1){ moNhanh.add(c.key); w(c);} }); })(dungCay());
  veTongHop();
});
$('thGapTatCa').addEventListener('click', ()=>{ moNhanh.clear(); veTongHop(); });
if($('thAnXong')){
  try{ $('thAnXong').checked = localStorage.getItem('anXongCay')==='1'; }catch(e){}
  $('thAnXong').addEventListener('change', ()=>{
    try{ localStorage.setItem('anXongCay', $('thAnXong').checked?'1':'0'); }catch(e){}
    veTongHop();
  });
}

/* ---------- VIỆC CỦA TÔI ---------- */
let cheDoToi = 'list';   /* list | cay */
let sapXepToi = 'tiendo-asc';
const moNhanhToi = new Set();
try{ cheDoToi = localStorage.getItem('cheDoToi') || 'list'; }catch(e){}
try{ sapXepToi = localStorage.getItem('sapXepToi') || 'tiendo-asc'; }catch(e){}

function sapXepDuAn(maList, viecTheoDA){
  const tienDoDA = ma => {
    const vs = viecTheoDA[ma]; if(!vs.length) return 0;
    return vs.reduce((s,v)=>s+pctTrangThai(v.trangthai),0)/vs.length;
  };
  const uutienDA = ma => {
    const rank = {'Cao':3,'Trung bình':2,'Thấp':1};
    return Math.max(...viecTheoDA[ma].map(v=>rank[v.uutien]||2));
  };
  const arr = maList.slice();
  if(sapXepToi==='tiendo-asc') arr.sort((a,b)=>tienDoDA(a)-tienDoDA(b));
  else if(sapXepToi==='tiendo-desc') arr.sort((a,b)=>tienDoDA(b)-tienDoDA(a));
  else if(sapXepToi==='uutien') arr.sort((a,b)=>uutienDA(b)-uutienDA(a));
  else arr.sort();
  return arr;
}

function veViecCuaToi(){
  const selT = $('toiNguoi');
  if(selT.dataset.loaded !== '1'){
    const ds = [...new Set(
      (typeof DANH_SACH_NHAN_SU!=='undefined' ? DANH_SACH_NHAN_SU : [])
      .concat(NHIEM_VU.flatMap(v=>v.nguoi.split(',').map(s=>s.trim())))
      .filter(Boolean))].sort();
    ds.forEach(n=>selT.add(new Option(n,n)));
    selT.dataset.loaded = '1';
    if(nguoiCuaToi) selT.value = nguoiCuaToi;
  }
  if($('toiCheDo')) $('toiCheDo').value = cheDoToi;
  const anXongToi = $('toiAnXong') && $('toiAnXong').checked;
  if($('toiSapXep')) $('toiSapXep').value = sapXepToi;
  /* nút mở/gập chỉ hiện khi xem dạng cây */
  if($('toiMoTatCa')) $('toiMoTatCa').hidden = (cheDoToi!=='cay');
  if($('toiGapTatCa')) $('toiGapTatCa').hidden = (cheDoToi!=='cay');
  nguoiCuaToi = selT.value;
  const wrap = $('toiNoiDung');
  if(!nguoiCuaToi){ wrap.innerHTML = '<div class="th-empty">Chọn tên bạn ở trên để xem việc được giao.</div>'; if($('toiLocDA')) $('toiLocDA').innerHTML='<option value="">Tất cả dự án</option>'; return; }

  let viec = NHIEM_VU.filter(v => v.nguoi.split(',').map(s=>s.trim()).includes(nguoiCuaToi));
  if(!viec.length){ wrap.innerHTML = '<div class="th-empty">Không có việc nào giao cho '+thoatHTML(nguoiCuaToi)+'.</div>'; if($('toiLocDA')) $('toiLocDA').innerHTML='<option value="">Tất cả dự án</option>'; return; }

  /* phát hiện việc MỚI chưa xem (1 lần/phiên cho mỗi người) */
  if(veViecCuaToi._moiNguoi !== nguoiCuaToi){
    veViecCuaToi._moiNguoi = nguoiCuaToi;
    veViecCuaToi._moi = new Set();
    try{
      const key = 'daXem:'+nguoiCuaToi;
      const daXem = new Set(JSON.parse(localStorage.getItem(key) || '[]'));
      viec.forEach(v=>{ if(!daXem.has(idViec(v))) veViecCuaToi._moi.add(idViec(v)); });
      const tatCa = viec.map(idViec);
      localStorage.setItem(key, JSON.stringify(tatCa));   /* đánh dấu đã xem cho lần sau */
    }catch(e){ veViecCuaToi._moi = new Set(); }
  }

  /* nạp bộ lọc dự án theo các dự án người này có việc */
  const selDA = $('toiLocDA');
  if(selDA){
    const giuLai = selDA.value;
    const maDS = [...new Set(viec.map(v=>v.mada))].sort();
    selDA.innerHTML = '<option value="">Tất cả dự án</option>'
      + maDS.map(ma=>{ const d=DU_AN.find(x=>x.ma===ma); return '<option value="'+thoatHTML(ma)+'"'+(d?' title="'+thoatHTML(d.ten)+'"':'')+'>'+thoatHTML(ma)+'</option>'; }).join('');
    if(maDS.includes(giuLai)) selDA.value = giuLai;
    if(selDA.value) viec = viec.filter(v=>v.mada===selDA.value);
    if(!viec.length){ wrap.innerHTML = '<div class="th-empty">Không có việc trong dự án đã lọc.</div>'; return; }
  }

  const theoDA = {};
  viec.forEach(v=>{ (theoDA[v.mada] = theoDA[v.mada] || []).push(v); });
  const xong = viec.filter(v=>chuanCot(v.trangthai)==='Hoàn thành').length;
  const dang = viec.filter(v=>['Đang thực hiện / Chỉnh sửa','Trình duyệt KCS / TT'].includes(chuanCot(v.trangthai))).length;
  const chua = viec.length - xong - dang;

  let html = '<div class="toi-tom"><span><b>'+viec.length+'</b> việc</span>'
    + '<span style="color:var(--concrete)">'+chua+' chưa</span>'
    + '<span style="color:var(--amber)">'+dang+' đang</span>'
    + '<span style="color:var(--green)">'+xong+' xong</span></div>';

  const dsMa = sapXepDuAn(Object.keys(theoDA), theoDA);

  if(cheDoToi === 'cay'){
    /* ----- Chế độ CÂY theo dự án ----- */
    dsMa.forEach(ma=>{
      const da = DU_AN.find(d=>d.ma===ma);
      const vs = theoDA[ma];
      const vsHien = anXongToi ? vs.filter(v=>chuanCot(v.trangthai)!=='Hoàn thành') : vs;
      if(!vsHien.length) return;   /* cả dự án đã xong & đang ẩn */
      const pDA = Math.round(vs.reduce((s,v)=>s+pctTrangThai(v.trangthai),0)/vs.length);
      html += '<div class="toi-da-row" data-mato="'+thoatHTML(ma)+'">'
        + '<span class="toi-da-ten">'+( moNhanhToi.has(ma)?'▾':'▸' )+' '+thoatHTML(ma)+(da?' — '+thoatHTML(da.ten):'')+'</span>'
        + '<span class="toi-da-bar"><span style="width:'+pDA+'%;background:'+mauPct(pDA)+'"></span></span>'
        + '<span class="toi-da-pct" style="color:'+mauPct(pDA)+'">'+pDA+'%</span></div>';
      if(!moNhanhToi.has(ma)) return;
      /* dựng cây phân cấp trong dự án */
      const root = {con:new Map(), viec:[], key:ma};
      vsHien.forEach(v=>{
        let node=root, key=ma;
        tachCap(v.phancap).forEach(seg=>{ key+='/'+seg;
          if(!node.con.has(seg)) node.con.set(seg,{ten:seg,con:new Map(),viec:[],key:key});
          node=node.con.get(seg); });
        node.viec.push(v);
      });
      (function walk(node, depth){
        [...node.con.values()].forEach(c=>{
          const soCon=c.con.size, soViec=c.viec.length;
          if(soCon===0 && soViec===1){ html += dongLaToi(c.ten, c.viec[0], depth); return; }
          const p = Math.round(viecTrong(c).reduce((s,v)=>s+pctTrangThai(v.trangthai),0)/viecTrong(c).length);
          html += '<div class="th-row th-br" data-moto="'+thoatHTML(c.key)+'">'
            + '<span class="th-ten" style="padding-left:'+(10+depth*18)+'px;font-weight:600"><span class="th-ico">'+(moNhanhToi.has(c.key)?'▾':'▸')+'</span>'+thoatHTML(c.ten)+'</span>'
            + '<span class="th-c-tt"></span><span class="th-c-ng th-dem">'+soViec+' việc</span>'
            + '<span class="th-c-pct"><span class="th-bar"><span class="th-fill" style="width:'+p+'%;background:'+mauPct(p)+'"></span></span><span class="th-pct" style="color:'+mauPct(p)+'">'+p+'%</span></span></div>';
          if(moNhanhToi.has(c.key)){ walk(c, depth+1); c.viec.forEach(v=>{ html += dongLaToi(v.nhiemvu||tachCap(v.phancap).slice(-1)[0]||'(việc)', v, depth+1); }); }
        });
      })(root, 1);
    });
  } else {
    /* ----- Chế độ DANH SÁCH: gom theo độ khẩn ----- */
    const nhom = { tre:[], tuan:[], xa:[], xong:[] };
    viec.forEach(v=>{
      if(chuanCot(v.trangthai)==='Hoàn thành'){ nhom.xong.push(v); return; }
      const n = soNgayConLai(docNgay(v.han));
      if(n!==null && n<0) nhom.tre.push(v);
      else if(n!==null && n<=7) nhom.tuan.push(v);
      else nhom.xa.push(v);
    });
    /* trong mỗi nhóm: trễ nhiều/đến hạn sớm lên đầu, rồi ưu tiên cao */
    const rankUt = {'Cao':3,'Trung bình':2,'Thấp':1};
    const sapNhom = arr => arr.sort((a,b)=>{
      const na=soNgayConLai(docNgay(a.han)), nb=soNgayConLai(docNgay(b.han));
      const va = na===null?9999:na, vb = nb===null?9999:nb;
      if(va!==vb) return va-vb;
      return (rankUt[b.uutien]||2)-(rankUt[a.uutien]||2);
    });
    sapNhom(nhom.tre); sapNhom(nhom.tuan); sapNhom(nhom.xa);

    const veNhom = (title, cls, arr, moMacDinh) => {
      if(!arr.length) return '';
      const moKey = 'nhom:'+cls;
      const mo = moMacDinh ? !moNhanhToi.has('dong:'+cls) : moNhanhToi.has(moKey);
      let h = '<div class="toi-nhom '+cls+'" data-nhom="'+cls+'" data-modef="'+(moMacDinh?1:0)+'">'
        + '<span>'+(mo?'▾':'▸')+' '+title+'</span><span class="toi-nhom-so">'+arr.length+'</span></div>';
      if(mo) h += arr.map(v=>dongViecToi(v)).join('');
      return h;
    };
    html += veNhom('🔴 Đã trễ hạn','tre',nhom.tre,true);
    html += veNhom('🟠 Trong tuần này','tuan',nhom.tuan,true);
    html += veNhom('⚪ Còn xa / chưa có hạn','xa',nhom.xa,true);
    if(!anXongToi) html += veNhom('✓ Đã hoàn thành','xong',nhom.xong,false);
  }
  wrap.innerHTML = html;
}
/* 1 dòng việc ở "Việc của tôi" — pill chạm để xoay trạng thái + cờ vướng mắc */
function idViec(v){ return v.mada+'|'+(v.phancap||'')+'|'+(v.nhiemvu||'')+'|'+v.nguoi; }
function laMoi(v){ return veViecCuaToi._moi && veViecCuaToi._moi.has(idViec(v)); }
function dongViecToi(v){
  const capCuoi = tachCap(v.phancap).slice(-1)[0] || '';
  const tenViec = v.nhiemvu || capCuoi || '(việc chưa đặt tên)';
  const duong = (v.phancap ? thoatHTML(v.phancap) : '');
  const c = chuanCot(v.trangthai);
  let pillTxt='Chưa', pillCol='var(--concrete)';
  if(c==='Hoàn thành'){ pillTxt='Xong'; pillCol='var(--green)'; }
  else if(c==='Trình duyệt KCS / TT'){ pillTxt='Duyệt'; pillCol='var(--orange)'; }
  else if(c==='Đang thực hiện / Chỉnh sửa'){ pillTxt='Đang'; pillCol='var(--amber)'; }
  const vm = v.vuongmac ? '<div class="toi-vm">⚠ '+thoatHTML(v.vuongmac)+'</div>' : '';
  const hanTxt = (v.han && v.han!=='-') ? '<span class="toi-han">⏳ '+thoatHTML(v.han)+'</span>' : '';
  return '<div class="toi-viec'+(v.vuongmac?' co-vm':'')+'" data-uid="'+v.uid+'">'
    + '<div class="toi-noidung">'+(duong?'<span class="toi-path">'+duong+'</span>':'')
      + (laMoi(v)?'<span class="badge-moi">• Mới</span>':'') + '<span class="toi-tenviec">'+thoatHTML(tenViec)+'</span>'+hanTxt+vm+'</div>'
    + '<button class="toi-pill" type="button" data-ttpick="'+v.uid+'" style="color:'+pillCol+';border-color:'+pillCol+'" title="Bấm để đổi trạng thái">'+pillTxt+'</button>'
    + '<button class="toi-vm-nut'+(v.vuongmac?' on':'')+'" type="button" data-vm="'+v.uid+'" title="Báo/gỡ vướng mắc">⚠</button>'
    + '<button class="toi-sua" type="button" data-suatoi="'+v.uid+'" title="Sửa chi tiết">✎</button></div>';
}
function viecTrong(node){ let a=node.viec.slice(); node.con.forEach(c=>a=a.concat(viecTrong(c))); return a; }
function dongLaToi(ten, v, depth){
  const p = pctTrangThai(v.trangthai);
  const ghichu = (v.nhiemvu && v.nhiemvu!==ten) ? '<span class="th-note">'+thoatHTML(v.nhiemvu)+'</span>' : '';
  return '<div class="th-row th-leaf" data-cbuid="'+v.uid+'">'
    + '<span class="th-ten" style="padding-left:'+(10+depth*18)+'px"><span class="th-ico"></span>'+(laMoi(v)?'<span class="badge-moi">• Mới</span>':'')+thoatHTML(ten)+ghichu+'</span>'
    + '<span class="th-c-tt" data-ttpick="'+v.uid+'" title="Bấm để đổi trạng thái">'+chipTrangThaiNho(v.trangthai)+'</span>'
    + '<span class="th-c-ng">'+(v.han&&v.han!=='-'?'⏳ '+thoatHTML(v.han):'')+'</span>'
    + '<span class="th-c-pct"><span class="th-bar"><span class="th-fill" style="width:'+p+'%;background:'+mauPct(p)+'"></span></span><span class="th-pct" style="color:'+mauPct(p)+'">'+p+'%</span></span></div>';
}
$('toiNguoi').addEventListener('change', e=>{
  nguoiCuaToi = e.target.value;
  try{ localStorage.setItem('nguoiCuaToi', nguoiCuaToi); }catch(x){}
  veViecCuaToi();
});
if($('toiCheDo')) $('toiCheDo').addEventListener('change', e=>{
  cheDoToi = e.target.value;
  try{ localStorage.setItem('cheDoToi', cheDoToi); }catch(x){}
  veViecCuaToi();
});
if($('toiSapXep')) $('toiSapXep').addEventListener('change', e=>{
  sapXepToi = e.target.value;
  try{ localStorage.setItem('sapXepToi', sapXepToi); }catch(x){}
  veViecCuaToi();
});
if($('toiLocDA')) $('toiLocDA').addEventListener('change', veViecCuaToi);
if($('toiMoTatCa')) $('toiMoTatCa').addEventListener('click', ()=>{
  const viec = NHIEM_VU.filter(v => v.nguoi.split(',').map(s=>s.trim()).includes(nguoiCuaToi));
  viec.forEach(v=>{ moNhanhToi.add(v.mada); let key=v.mada; tachCap(v.phancap).forEach(seg=>{ key+='/'+seg; moNhanhToi.add(key); }); });
  veViecCuaToi();
});
if($('toiGapTatCa')) $('toiGapTatCa').addEventListener('click', ()=>{ moNhanhToi.clear(); veViecCuaToi(); });
if($('toiAnXong')){
  try{ $('toiAnXong').checked = localStorage.getItem('anXongToi')==='1'; }catch(e){}
  $('toiAnXong').addEventListener('change', ()=>{
    try{ localStorage.setItem('anXongToi', $('toiAnXong').checked?'1':'0'); }catch(e){}
    veViecCuaToi();
  });
}
/* Bấm ✎ / pill / vướng mắc / gập nhóm trong "Việc của tôi" */
$('toiNoiDung').addEventListener('click', e=>{
  const vmb = e.target.closest('[data-vm]');
  if(vmb){ datVuongMac(Number(vmb.dataset.vm)); return; }
  const nhomRow = e.target.closest('.toi-nhom');
  if(nhomRow){
    const cls = nhomRow.dataset.nhom, def = nhomRow.dataset.modef==='1';
    const k = (def?'dong:':'nhom:')+cls;
    if(moNhanhToi.has(k)) moNhanhToi.delete(k); else moNhanhToi.add(k);
    veViecCuaToi(); return;
  }
  const nut = e.target.closest('[data-suatoi]');
  if(nut){ moFormSuaViec(Number(nut.dataset.suatoi)); return; }
  const daRow = e.target.closest('[data-mato]');
  if(daRow){ const k=daRow.dataset.mato; if(moNhanhToi.has(k))moNhanhToi.delete(k);else moNhanhToi.add(k); veViecCuaToi(); return; }
  const br = e.target.closest('[data-moto]');
  if(br){ const k=br.dataset.moto; if(moNhanhToi.has(k))moNhanhToi.delete(k);else moNhanhToi.add(k); veViecCuaToi(); return; }
  const la = e.target.closest('.th-leaf');
  if(la && la.dataset.cbuid){ moFormSuaViec(Number(la.dataset.cbuid)); return; }
});
/* Báo / gỡ vướng mắc nhanh (ghi cả việc về Sheets) */
async function datVuongMac(uid){
  const nv = NHIEM_VU.find(v=>v.uid===uid); if(!nv) return;
  const lyDo = prompt('Mô tả vướng mắc (để TRỐNG rồi OK để gỡ cờ):', nv.vuongmac || '');
  if(lyDo === null) return;              /* bấm Hủy */
  const moi = lyDo.trim();
  if(moi === (nv.vuongmac||'')) return;
  let mk = maXacNhanCache || prompt('Nhập mã xác nhận của phòng để lưu:');
  if(!mk) return;
  const cu = nv.vuongmac; nv.vuongmac = moi;
  try{
    const res = await fetch(LINK_APPS_SCRIPT, { method:'POST', body: JSON.stringify({
      type:'suanhiemvu', matkhau: mk, data:{
        magoc: nv.mada, nvgoc: nv.nhiemvu, nguoigoc: nv.nguoi, phancapgoc: nv.phancap||'',
        mada: nv.mada, phancap: nv.phancap||'', hangmuc: nv.hangmuc||'', nhiemvu: nv.nhiemvu,
        nguoi: nv.nguoi, uutien: nv.uutien, han: nv.han||'-', trangthai: chuanCot(nv.trangthai),
        ghichu: nv.ghichu||'', vuongmac: moi
      } }) });
    const kq = await res.json();
    if(kq.ok){ nhoMaTrongPhien(mk); chamHoatDong(); lanGhiCuoi = Date.now(); baoToast(moi?'⚠ Đã báo vướng mắc':'✔ Đã gỡ vướng mắc','ok'); veViecCuaToi(); veViewPhu(); }
    else { nv.vuongmac = cu; baoToast('✖ '+(kq.loi||'Lỗi'),'err'); }
  }catch(err){ nv.vuongmac = cu; baoToast('✖ '+err.message,'err'); }
}
/* Cập nhật trạng thái 1 việc về Sheets (dùng cho dropdown + chuột phải) */
async function capNhatTrangThaiViec(uid, ttMoi){
  const nv = NHIEM_VU.find(v=>v.uid===uid); if(!nv) return false;
  const ttCu = nv.trangthai;
  if(chuanCot(ttCu)===ttMoi) return false;
  let mk = maXacNhanCache || prompt('Nhập mã xác nhận của phòng để lưu:');
  if(!mk) return false;
  nv.trangthai = ttMoi;
  try{
    const res = await fetch(LINK_APPS_SCRIPT, { method:'POST',
      body: JSON.stringify({ type:'sua_trangthai_nhiemvu', matkhau: mk,
        data:{ mada: nv.mada, trangthai: ttMoi, items:[{nhiemvu:nv.nhiemvu, nguoi:nv.nguoi, phancap:nv.phancap}] } }) });
    const kq = await res.json();
    if(kq.ok){ nhoMaTrongPhien(mk); chamHoatDong(); lanGhiCuoi = Date.now(); baoToast('✔ Đã cập nhật', 'ok'); veViewPhu(); veDanhSach(); return true; }
    nv.trangthai = ttCu; baoToast('✖ '+(kq.loi||'Lỗi'), 'err'); return false;
  }catch(err){ nv.trangthai = ttCu; baoToast('✖ '+err.message, 'err'); return false; }
}
/* Đổi trạng thái ngay trong "Việc của tôi" — ghi 1 việc về Sheets */
$('toiNoiDung').addEventListener('change', async e=>{
  const sel = e.target.closest('.toi-tt'); if(!sel) return;
  const uid = Number(sel.dataset.uid);
  const nv = NHIEM_VU.find(v=>v.uid===uid); if(!nv) return;
  const ttMoi = sel.value, ttCu = nv.trangthai;
  if(chuanCot(ttCu)===ttMoi) return;
  sel.disabled = true;
  const ok = await capNhatTrangThaiViec(uid, ttMoi);
  if(!ok) sel.value = chuanCot(ttCu);
  sel.disabled = false;
});
/* (handler cũ giữ tương thích — không dùng nữa) */

/* Nút chuyển màn hình */
document.querySelectorAll('.view-tab').forEach(b=>{
  b.addEventListener('click', ()=>doiView(b.dataset.view));
});

/* ===== Đổi trạng thái: chuột trái (PC) / nhấn giữ (ĐT) — cho cả tab 2 & 3 ===== */
let _ttPickUid = null, _lpTimer = null, _lpFired = false, _lastPtr = 'mouse';
function moMenuTrangThai(uid, x, y){
  _ttPickUid = uid;
  const nv = NHIEM_VU.find(v=>v.uid===uid);
  const cur = nv ? chuanCot(nv.trangthai) : '';
  const menu = $('menuTrangThai');
  menu.querySelectorAll('.mtt').forEach(li=>{
    li.classList.toggle('dang-chon', li.dataset.tt===cur);
  });
  /* canh trong màn hình */
  const mw = 220, mh = 180;
  const px = Math.min(x, window.innerWidth - mw);
  const py = Math.min(y, window.innerHeight - mh + window.scrollY);
  menu.style.left = Math.max(8, px) + 'px';
  menu.style.top = (py + window.scrollY) + 'px';
  menu.classList.add('show');
}
document.addEventListener('pointerdown', e=>{
  _lastPtr = e.pointerType || 'mouse';
  const el = e.target.closest('[data-ttpick]');
  if(el && e.pointerType==='touch'){
    _lpFired = false;
    const uid = Number(el.dataset.ttpick), x = e.clientX, y = e.clientY;
    _lpTimer = setTimeout(()=>{ _lpFired = true; if(navigator.vibrate) navigator.vibrate(15); moMenuTrangThai(uid, x, y); }, 480);
  }
});
['pointermove','pointerup','pointercancel'].forEach(ev=>document.addEventListener(ev, ()=>{ if(_lpTimer){ clearTimeout(_lpTimer); _lpTimer=null; } }));
document.addEventListener('click', e=>{
  const el = e.target.closest('[data-ttpick]');
  if(!el) return;
  if(_lpFired){ _lpFired=false; e.preventDefault(); e.stopPropagation(); return; }  /* đã xử lý bằng nhấn giữ */
  if(_lastPtr==='touch') return;   /* ĐT chỉ dùng nhấn giữ, bỏ qua chạm thường */
  e.stopPropagation();
  const r = el.getBoundingClientRect();
  moMenuTrangThai(Number(el.dataset.ttpick), r.left, r.bottom);
});
document.querySelectorAll('#menuTrangThai .mtt').forEach(li=>{
  li.onclick = ()=>{ const tt = li.dataset.tt, uid = _ttPickUid; dongCtx(); if(uid!=null) capNhatTrangThaiViec(uid, tt); };
});


/* Gợi ý phân cấp đã dùng (cho ô cv-phancap) */

/* ---------- CẢNH BÁO TRỄ HẠN ---------- */
function dsTreHan(){
  const out = [];
  NHIEM_VU.forEach(v=>{
    if(chuanCot(v.trangthai)==='Hoàn thành') return;
    const n = soNgayConLai(docNgay(v.han));
    if(n !== null && n < 0) out.push({loai:'việc', mada:v.mada, ten:v.nhiemvu, phancap:v.phancap, nguoi:v.nguoi, tre:-n, uid:v.uid});
  });
  DU_AN.forEach(d=>{
    if(tinhTienDo(d.ma) >= 100) return;
    const n = soNgayConLai(docNgay(d.hannop));
    if(n !== null && n < 0) out.push({loai:'dự án', mada:d.ma, ten:d.ten, phancap:'', nguoi:d.phutrach, tre:-n, uid:null});
  });
  out.sort((a,b)=>b.tre - a.tre);
  return out;
}
function veCanhBao(){
  const bang = $('bangCanhBao'); if(!bang) return;
  const ds = dsTreHan();
  if(ds.length === 0){ bang.hidden = true; return; }
  bang.hidden = false;
  $('cbSo').textContent = ds.length;
  $('cbChiTiet').innerHTML = ds.map(x=>{
    const duong = x.phancap ? thoatHTML(x.phancap)+' / ' : '';
    return '<div class="cb-dong"'+(x.uid?' data-cbuid="'+x.uid+'"':'')+'>'
      + '<span class="cb-badge">'+x.loai+'</span>'
      + '<span class="cb-ma">'+thoatHTML(x.mada)+'</span>'
      + '<span class="cb-ten">'+duong+thoatHTML(x.ten)+'</span>'
      + '<span class="cb-ng">'+thoatHTML(x.nguoi)+'</span>'
      + '<span class="cb-tre">trễ '+x.tre+' ngày</span></div>';
  }).join('');
}
$('cbToggle').addEventListener('click', ()=>{
  const ct = $('cbChiTiet');
  ct.hidden = !ct.hidden;
  $('cbMui').textContent = ct.hidden ? '▾' : '▴';
});
/* Bấm 1 dòng việc trễ → mở form sửa việc đó */
$('cbChiTiet').addEventListener('click', e=>{
  const d = e.target.closest('[data-cbuid]'); if(!d) return;
  moFormSuaViec(Number(d.dataset.cbuid));
});
taiDuLieu();
setInterval(()=>{ if(Date.now() - lanGhiCuoi > 6*60*1000) taiDuLieu(); }, 5*60*1000);