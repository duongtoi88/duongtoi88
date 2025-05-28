document.getElementById('upload').addEventListener('change', handleFile);
function convertToTree(rows) {
  const people = {};
  rows.forEach(row => {
    const id = String(row.ID).replace('.0', '');
    const idCha = String(row["ID cha"] || "").replace('.0', '');
    const idChong = String(row["ID chồng"] || "").replace('.0', '');

    // Lọc: chỉ nam (không có ID chồng)
    if (idChong && idChong !== "nan") return;

    people[id] = {
      id: id,
      name: row["Họ và tên"] || "",
      birth: row["Năm sinh"] || "",
      death: row["Năm mất"] || "",
      info: row["Thông tin chi tiết"] || "",
      spouse: "", // sẽ gán sau nếu cần
      father: idCha !== "nan" ? idCha : null,
      children: []
    };
  });

  // Gán children
  Object.values(people).forEach(p => {
    if (p.father && people[p.father]) {
      people[p.father].children.push(p);
    }
  });

  // Lọc gốc
  const rootCandidates = Object.values(people).filter(p => !p.father);
  return rootCandidates.length === 1
    ? rootCandidates[0]
    : { name: "Phả hệ", children: rootCandidates };
}


function handleFile(event) {
  const file = event.target.files[0];
  const reader = new FileReader();
  reader.onload = function (e) {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(sheet);
	window.rawRows = json; // << Dòng này rất quan trọng!
    const treeData = convertToTree(json);
    drawTree(treeData);
  };
  reader.readAsArrayBuffer(file);
}


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

  svg.selectAll('.link')
    .data(root.links())
    .enter()
    .append('path')
    .attr('class', 'link')
    .attr('d', d3.linkVertical()
      .x(d => d.x)
      .y(d => d.y)
    );

  const node = svg.selectAll('.node')
    .data(root.descendants())
    .enter()
    .append('g')
    .attr('class', 'node')
    .attr('transform', d => `translate(${d.x},${d.y})`)
    .on('click', (event, d) => showTooltip(event, d.data));

  node.append('rect')
    .attr('x', -30)
    .attr('y', -40)
    .attr('width', 60)
    .attr('height', 120);

node.append('text')
  .attr('x', 10)
  .attr('y', 15)
  .attr('text-anchor', 'middle')
  .text(d => d.data.name);

node.append('text')
  .attr('x', -10)
  .attr('y', 15)
  .attr('text-anchor', 'middle')
  .text(d => (d.data.birth || '') + ' - ' + (d.data.death || ''));

function showTooltip(event, data) {
  const name = `<div><b>${data.name}</b></div>`;
  const years = `<div>${data.birth || ''} - ${data.death || ''}</div>`;

  // Lấy danh sách vợ theo ID chồng
  const wives = window.rawRows.filter(r => {
    const idChong = String(r["ID chồng"] || "").replace('.0', '');
    return idChong === data.id;
  });
  const spouses = wives.length
    ? `<div><b>Vợ:</b></div>` + wives.map(w => `<div style="margin-left:10px">${w["Họ và tên"]}</div>`).join('')
    : `<div><b>Vợ:</b> -</div>`;

  const children = (data.children && data.children.length)
    ? `<div><b>Con:</b></div>` + data.children.map(c => `<div style="margin-left: 10px;">${c.name}</div>`).join('')
    : `<div><b>Con:</b> -</div>`;

  const info = `<div><b>Chi tiết:</b></div><div style="margin-left: 10px;">${data.info || '-'}</div>`;
  
  // Ảnh: đặt trong thư mục images/, tên file là ID.png
  const image = `<div style="margin-top: 10px;">
    <img src="images/${data.id}.png" alt="Ảnh ${data.name}" style="max-width: 120px; max-height: 120px; border: 1px solid #ccc;" />
  </div>`;

   // Gộp tất cả
  const tooltip = document.getElementById('tooltip');
  tooltip.innerHTML = name + years + spouses + children + info + image;
  tooltip.style.display = 'block';
  tooltip.style.left = (event.pageX + 10) + 'px';
  tooltip.style.top = (event.pageY + 10) + 'px';
  tooltip.style.textAlign = 'left';
}

  document.body.addEventListener('click', function(e) {
    if (!e.target.closest('.node')) {
      document.getElementById('tooltip').style.display = 'none';
    }
  });
}
