const { PDFDocument } = PDFLib;

/* ========== DOWNLOAD ========== */
function downloadPDF(bytes, name) {
  const blob = new Blob([bytes], { type: "application/pdf" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
}

/* ========== MERGE (DRAG REORDER) ========== */
let mergeFiles = [];

document.getElementById("mergeInput").addEventListener("change", e => {
  mergeFiles = [...e.target.files];
  renderMergeList();
});

function renderMergeList() {
  const list = document.getElementById("mergeList");
  list.innerHTML = "";

  mergeFiles.forEach((file, i) => {
    const li = document.createElement("li");
    li.textContent = file.name;
    li.className = "merge-item";
    li.draggable = true;

    li.ondragstart = ev => ev.dataTransfer.setData("i", i);
    li.ondragover = ev => ev.preventDefault();
    li.ondrop = ev => {
      const from = ev.dataTransfer.getData("i");
      [mergeFiles[from], mergeFiles[i]] =
        [mergeFiles[i], mergeFiles[from]];
      renderMergeList();
    };

    list.appendChild(li);
  });
}

async function mergePDF() {
  if (!mergeFiles.length) return alert("Select PDFs");

  const merged = await PDFDocument.create();
  for (let f of mergeFiles) {
    const pdf = await PDFDocument.load(await f.arrayBuffer());
    const pages = await merged.copyPages(pdf, pdf.getPageIndices());
    pages.forEach(p => merged.addPage(p));
  }
  downloadPDF(await merged.save(), "merged.pdf");
}

/* ========== SPLIT ========== */
async function splitPDF() {
  const file = document.getElementById("splitInput").files[0];
  if (!file) return alert("Upload PDF");

  const pdf = await PDFDocument.load(await file.arrayBuffer());
  for (let i = 0; i < pdf.getPageCount(); i++) {
    const n = await PDFDocument.create();
    const [p] = await n.copyPages(pdf, [i]);
    n.addPage(p);
    downloadPDF(await n.save(), `page_${i + 1}.pdf`);
  }
}

/* ========== COMPRESS ========== */
async function compressPDF() {
  const file = document.getElementById("compressInput").files[0];
  if (!file) return alert("Upload PDF");

  const pdf = await PDFDocument.load(await file.arrayBuffer());
  const bytes = await pdf.save({ compress: true, useObjectStreams: true });
  downloadPDF(bytes, "compressed.pdf");
}

/* ========== DELETE (HD PREVIEW + SWIPE) ========== */
let originalPdf, keepPages = [];

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

document.getElementById("deleteInput").addEventListener("change", async e => {
  const buffer = await e.target.files[0].arrayBuffer();
  originalPdf = await PDFDocument.load(buffer);
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

  const grid = document.getElementById("pagesGrid");
  grid.innerHTML = "";
  keepPages = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    keepPages.push(i - 1);

    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.2 }); // HD
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({
      canvasContext: canvas.getContext("2d"),
      viewport
    }).promise;

    const box = document.createElement("div");
    box.className = "page-thumb";

    const num = document.createElement("div");
    num.className = "page-number";
    num.innerText = i;

    box.appendChild(num);
    box.appendChild(canvas);

    let startX = 0;
    box.onclick = () => togglePage(box, i - 1);
    box.addEventListener("touchstart", e => startX = e.touches[0].clientX);
    box.addEventListener("touchend", e => {
      if (startX - e.changedTouches[0].clientX > 50)
        togglePage(box, i - 1);
    });

    grid.appendChild(box);
  }

  document.getElementById("pageSelector").classList.remove("hidden");
});

function togglePage(box, index) {
  box.classList.toggle("deselect");
  keepPages = keepPages.includes(index)
    ? keepPages.filter(p => p !== index)
    : [...keepPages, index];
}

async function createDeletedPDF() {
  if (!keepPages.length) return alert("Select at least one page");
  keepPages.sort((a, b) => a - b);

  const newPdf = await PDFDocument.create();
  const pages = await newPdf.copyPages(originalPdf, keepPages);
  pages.forEach(p => newPdf.addPage(p));

  downloadPDF(await newPdf.save(), "pages_deleted.pdf");
}
