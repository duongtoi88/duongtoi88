// Tự động đọc file Excel khi trang vừa load
window.onload = () => {
  fetch('input.xlsx')
    .then(res => res.arrayBuffer())
    .then(data => {
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet);

      console.log("Excel dữ liệu:", json); // kiểm tra dữ liệu

      window.rawRows = json; // lưu lại để tra vợ
      const treeData = convertToTree(json);
      drawTree(treeData);
    })
    .catch(err => {
      console.error("Không thể đọc file Excel:", err);
    });
};

// Chuyển dữ liệu phẳng thành dạng cây
function convertToTree(rows) {
  const people = {};

  rows.forEach(row => {
    const id = String(row.ID).replace('.0', '');
    const idCha = String(row["ID cha"] || "").replace('.0', '');
    const idChong = String(row["ID chồng"] || "").replace('.0', '');

    // Lọc chỉ con trai (không có ID chồng)
    if (idChong && idChong !== "nan") return;

    people[id] = {
      id,
      name: row["Họ và tên"] || "",
      birth: row["Năm sinh"] || "",
      death: row["Năm mất"] || "",
      info: row["Thông tin chi tiết"] || "",
      spouse: "",
      father: idCha !== "nan" ? idCha : null,
      children: []
    };
  });

  // Gán con cho cha
  Object.values(people).forEach(p => {
    if (p.father && people[p.father]) {
      people[p.father].children.push(p);
    }
  });

  // Tìm gốc cây
  const roots = Object.values(people).filter(p => !p.father);
  return roots.length === 1 ? roots[0] : { name: "Phả hệ", children: roots };
}

// Vẽ cây phả hệ bằng D3.js
function drawTree(data) {
  const width = 1600, height = 1000;

  const svg = d3.select('#tree-container').append('svg')
    .attr('width', width)
    .attr('height', height)
    .append('g')
    .attr('transform', 'translate(80,40)');

  const root = d3.hierarchy(data);
  const treeLayout = d3.tree().size([width - 160, height - 100]);
  treeLayout(root);

  // Vẽ đường nối
  svg.selectAll('.link')
    .data(root.links())
    .enter()
    .append('path')
    .attr('class', 'link')
    .attr('d', d3.linkVertical().x(d => d.x).y(d => d.y));

  // Tạo node
  const node = svg.selectAll('.node')
    .data(root.descendants())
    .enter()
    .append('g')
    .attr('class', 'node')
    .attr('transform', d => `translate(${d.x},${d.y})`)
    .on('click', (event, d) => showTooltip(event, d.data));

  // Hình chữ nhật dọc
  node.append('rect')
    .attr('x', -40)
    .attr('y', -60)
    .attr('width', 80)
    .attr('height', 120)
    .attr('rx', 10)
    .attr('ry', 10);

  // Tên theo chiều dọc
// Dòng 1: Tên
node.append('text')
  .attr('x', 0)
  .attr('y', -40)
  .attr('text-anchor', 'middle')
  .style('writing-mode', 'vertical-rl')
  .attr('fill', 'black')
  .text(d => d.data.name);

// Dòng 2: Năm sinh - năm mất
node.append('text')
  .attr('x', 0)
  .attr('y', 40)
  .attr('text-anchor', 'middle')
  .style('writing-mode', 'vertical-rl')
  .style('font-size', '12px')
  .attr('fill', 'black')
  .text(d => (d.data.birth || '') + ' - ' + (d.data.death || ''));
}

// Tooltip hiển thị chi tiết
function showTooltip(event, data) {
  const name = `<div><b>${data.name}</b></div>`;
  const years = `<div>${data.birth || ''} - ${data.death || ''}</div>`;

  // Lấy danh sách vợ
  const wives = window.rawRows.filter(r => {
    const idChong = String(r["ID chồng"] || "").replace('.0', '');
    return idChong === data.id;
  });
  const spouses = wives.length
    ? `<div><b>Vợ:</b></div>` + wives.map(w => `<div style="margin-left:10px">${w["Họ và tên"]}</div>`).join('')
    : `<div><b>Vợ:</b> -</div>`;

  // Lấy con
  const children = (data.children && data.children.length)
    ? `<div><b>Con:</b></div>` + data.children.map(c => `<div style="margin-left:10px">${c.name}</div>`).join('')
    : `<div><b>Con:</b> -</div>`;

  const info = `<div><b>Chi tiết:</b></div><div style="margin-left: 10px;">${data.info || '-'}</div>`;

  // Ảnh đại diện nếu có
  const image = `<div style="margin-top:10px;"><img src="images/${data.id}.png" alt="${data.name}" style="max-width: 120px; max-height: 120px; border:1px solid #ccc;" onerror="this.style.display='none'" /></div>`;

  const tooltip = document.getElementById('tooltip');
  tooltip.innerHTML = name + years + spouses + children + info + image;
  tooltip.style.display = 'block';
  tooltip.style.left = (event.pageX + 10) + 'px';
  tooltip.style.top = (event.pageY + 10) + 'px';
  tooltip.style.textAlign = 'left';
}

// Ẩn tooltip nếu click ra ngoài
document.body.addEventListener('click', function (e) {
  if (!e.target.closest('.node')) {
    document.getElementById('tooltip').style.display = 'none';
  }
});
