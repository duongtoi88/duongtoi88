// Tự động đọc file Excel khi trang vừa load
window.onload = () => {
  fetch('https://duongtoi88.github.io/duongtoi88/input.xlsx')
    .then(res => res.arrayBuffer())
    .then(data => {
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet);

      window.rawRows = json;

      // Tạo dropdown chọn ID gốc (Đinh x)
      const rootIDs = json.filter(r => r.Đinh === "x").map(r => String(r.ID).replace('.0', ''));
      const select = document.createElement("select");
      select.id = "rootSelector";
      select.style.marginBottom = "10px";

      rootIDs.forEach(id => {
        const r = json.find(p => String(p.ID).replace('.0', '') === id);
        const opt = document.createElement("option");
        opt.value = id;
        opt.text = `${r["Họ và tên"]} (${id})`;
        select.appendChild(opt);
      });

      // Thêm sự kiện chọn ID
      select.onchange = () => {
        const selectedID = select.value;
        const includeGirls = document.getElementById("showGirls").checked;
        const rootTree = convertToSubTree(json, selectedID, includeGirls);
        document.getElementById("tree-container").innerHTML = "";
        drawTree(rootTree);
      };

      // Thêm vào DOM
      document.body.insertBefore(select, document.getElementById("tree-container"));

      // Sự kiện tick "Cả Nam & Nữ"
      document.getElementById("showGirls").onchange = () => {
        const selectedID = document.getElementById("rootSelector").value;
        const includeGirls = document.getElementById("showGirls").checked;
        const rootTree = convertToSubTree(json, selectedID, includeGirls);
        document.getElementById("tree-container").innerHTML = "";
        drawTree(rootTree);
      };

      // Vẽ cây mặc định
      const defaultRoot = rootIDs[0];
      const treeData = convertToSubTree(json, defaultRoot, false);
      drawTree(treeData);
    })
    .catch(err => {
      console.error("Không thể đọc file Excel:", err);
    });
};

// Duyệt cây con từ ID gốc
function convertToSubTree(rows, rootID, includeGirls = false) {
  const people = {};
  const validIDs = new Set();

  rows.forEach(row => {
    const id = String(row.ID).replace('.0', '');
    people[id] = {
      id,
      name: row["Họ và tên"] || "",
      birth: row["Năm sinh"] || "",
      death: row["Năm mất"] || "",
      info: row["Thông tin chi tiết"] || "",
      father: row["ID cha"] ? String(row["ID cha"]).replace('.0', '') : null,
      mother: row["ID mẹ"] ? String(row["ID mẹ"]).replace('.0', '') : null,
      spouse: row["ID chồng"] ? String(row["ID chồng"]).replace('.0', '') : null,
      doi: row["Đời"] || "",
      dinh: row["Đinh"] || "",
      children: []
    };
  });

  function collectDescendants(id) {
    if (!people[id]) return;
    if (includeGirls || people[id].dinh === "x") {
      validIDs.add(id);
    }

    rows.forEach(r => {
      const childID = String(r.ID).replace('.0', '');
      const fatherID = r["ID cha"] ? String(r["ID cha"]).replace('.0', '') : null;
      if (fatherID === id) {
        if (includeGirls || r["Đinh"] === "x") {
          collectDescendants(childID);
        }
      }
    });
  }

  collectDescendants(rootID);

  if (includeGirls) {
    rows.forEach(r => {
      const idChong = String(r["ID chồng"] || "").replace('.0', '');
      if (validIDs.has(idChong)) {
        validIDs.add(String(r.ID).replace('.0', ''));
      }
    });
  }

  const treePeople = {};
  validIDs.forEach(id => {
    if (people[id]) treePeople[id] = people[id];
  });

  Object.values(treePeople).forEach(p => {
    if (p.dinh === "x") {
      p.spouses = Object.values(people).filter(w =>
        w.spouse === p.id && validIDs.has(w.id)
      );
    }
  });

  Object.values(treePeople).forEach(p => {
    if (p.father && treePeople[p.father]) {
      const isSpouse = Object.values(treePeople).some(tp =>
        tp.spouses && tp.spouses.find(sp => sp.id === p.id)
      );
      if (!isSpouse) {
        treePeople[p.father].children.push(p);
      }
    }
  });

  Object.values(treePeople).forEach(p => {
    p.children.sort((a, b) => {
      const aYear = parseInt(a.birth) || 9999;
      const bYear = parseInt(b.birth) || 9999;
      return aYear - bYear;
    });
  });

  return treePeople[rootID];
}

// Vẽ cây phả hệ bằng D3.js
function drawTree(data) {
  const root = d3.hierarchy(data);
  const nodeWidth = 120;
  const nodeHeight = 200;
  const treeLayout = d3.tree().nodeSize([nodeWidth, nodeHeight]);
  treeLayout(root);

  const bounds = root.descendants().reduce(
    (acc, d) => ({
      x0: Math.min(acc.x0, d.x),
      x1: Math.max(acc.x1, d.x),
      y0: Math.min(acc.y0, d.y),
      y1: Math.max(acc.y1, d.y)
    }),
    { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity }
  );

  const dx = bounds.x1 - bounds.x0;
  const dy = bounds.y1 - bounds.y0;
  const marginX = 100;
  const screenW = window.innerWidth;
  const scale = Math.min(1, screenW * 0.95 / (dx + marginX));
  const totalWidth = dx * scale;
  const translateX = (screenW - totalWidth) / 2 - bounds.x0 * scale;
  const translateY = 40 - bounds.y0 * scale;

  d3.select("#tree-container").selectAll("svg").remove();
  const svg = d3.select("#tree-container").append("svg")
    .attr("width", screenW)
    .attr("height", dy + 300);

  const g = svg.append("g")
    .attr("transform", `translate(${translateX}, ${translateY}) scale(${scale})`);

  g.selectAll(".link")
    .data(root.links())
    .enter()
    .append("path")
    .attr("fill", "none")
    .attr("stroke", "#555")
    .attr("stroke-width", 2)
    .attr("d", d => {
      const x1 = d.source.x, y1 = d.source.y;
      const x2 = d.target.x, y2 = d.target.y;
      const midY = (y1 + y2) / 2;
      return `M ${x1},${y1} V ${midY} H ${x2} V ${y2}`;
    });

  const node = g.selectAll(".node")
    .data(root.descendants())
    .enter()
    .append("g")
    .attr("class", "node")
    .attr("transform", d => `translate(${d.x},${d.y})`)
    .on("click", (event, d) => openDetailTab(d.data.id))
    .on("mouseover", (event, d) => showQuickTooltip(event, d.data))
    .on("mouseout", () => document.getElementById("tooltip").style.display = "none");

  node.append("rect")
    .attr("x", -40)
    .attr("y", -60)
    .attr("width", 80)
    .attr("height", 120)
    .attr("rx", 10)
    .attr("ry", 10)
    .attr("class", d => d.data.dinh === "x" ? "dinh-x" : "dinh-thuong");

  node.append("text")
    .attr("text-anchor", "middle")
    .attr("transform", "translate(10, 0)")
    .style("font-size", "12px")
    .attr("fill", "black")
    .text(d => d.data.name);

  node.append("text")
    .attr("text-anchor", "middle")
    .attr("transform", "translate(-10, 0)")
    .style("font-size", "12px")
    .attr("fill", "black")
    .text(d => (d.data.birth || "") + " - " + (d.data.death || ""));

  // Vẽ node vợ bên cạnh chồng
  root.descendants().forEach(d => {
    const data = d.data;
    const x = d.x;
    const y = d.y;
    const offset = 100;

    if (data.spouses && data.spouses.length > 0) {
      data.spouses.forEach((wife, i) => {
        const wifeX = x + offset + i * 100;

        const wifeGroup = g.append("g")
          .attr("class", "node")
          .attr("transform", `translate(${wifeX},${y})`)
          .on("click", () => openDetailTab(wife.id))
          .on("mouseover", (event) => showQuickTooltip(event, wife))
          .on("mouseout", () => document.getElementById("tooltip").style.display = "none");

        wifeGroup.append("rect")
          .attr("x", -40)
          .attr("y", -60)
          .attr("width", 80)
          .attr("height", 120)
          .attr("rx", 10)
          .attr("ry", 10)
          .attr("class", "node-vo");

        wifeGroup.append("text")
          .attr("text-anchor", "middle")
          .attr("y", 0)
          .style("font-size", "12px")
          .attr("fill", "black")
          .text(wife.name);
      });
    }
  });
}

// Tooltip ngắn khi hover
function showQuickTooltip(event, data) {
  const wives = window.rawRows.filter(r => {
    const idChong = String(r["ID chồng"] || "").replace('.0', '');
    return idChong === data.id;
  });

  const children = data.children || [];

  const html = `
    <div><b>${data.name || "-"}</b> – Đời ${data.doi || "-"}</div>
    <div>${data.birth || "-"} – ${data.death || "-"}</div>
    <div><b>Vợ/Chồng:</b> ${wives.length ? wives.map(w => `- ${w["Họ và tên"]}`).join("<br>") : "-"}</div>
    <div><b>Con:</b> ${children.length ? children.map(c => `- ${c.name}`).join("<br>") : "-"}</div>
  `;

  const tooltip = document.getElementById("tooltip");
  tooltip.innerHTML = html;
  tooltip.style.display = 'block';
  tooltip.style.left = (event.pageX + 10) + 'px';
  tooltip.style.top = (event.pageY + 10) + 'px';
  tooltip.style.textAlign = 'left';
}
// Click mở tab chi tiết
function openDetailTab(id) {
  window.location.href = `detail.html?id=${id}`;
}
