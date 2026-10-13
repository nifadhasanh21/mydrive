
// 1. SUPABASE CONFIG

const SUPABASE_URL = "https://tudrjlcyxjjrvkpfbxmv.supabase.co"; 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1ZHJqbGN5eGpqcnZrcGZieG12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5MTE5MTEsImV4cCI6MjEwNzQ4NzkxMX0.xW-2F-Uik2aLya8yflMLNiGr-IvsmuyN2z85o3UK9F8"; 
const BUCKET_NAME = "my-pdfs";

let supabaseClient = null;
if (window.supabase) {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// DOM Elements
const lockModal = document.getElementById("lockModal");
const loginForm = document.getElementById("loginForm");
const passInput = document.getElementById("passInput");
const unlockBtn = document.getElementById("unlockBtn");
const lockError = document.getElementById("lockError");
const mainContainer = document.getElementById("mainContainer");
const logoutBtn = document.getElementById("logoutBtn");

const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
const uploadBtn = document.getElementById("uploadBtn");
const selectedFileName = document.getElementById("selectedFileName");
const fileList = document.getElementById("fileList");
const fileCount = document.getElementById("fileCount");
const searchInput = document.getElementById("searchInput");
const statusMessage = document.getElementById("statusMessage");

const pdfModal = document.getElementById("pdfModal");
const modalContent = document.getElementById("modalContent");
const modalBody = document.getElementById("modalBody");
const pdfFrame = document.getElementById("pdfFrame");
const modalTitle = document.getElementById("modalTitle");
const closeModal = document.getElementById("closeModal");
const toggleFullscreenBtn = document.getElementById("toggleFullscreenBtn");

let selectedFile = null;
let allFiles = [];


// 2. SESSION & SECURITY

function checkSession() {
  const isUnlocked = localStorage.getItem("mydrive_unlocked");
  if (isUnlocked === "true") {
    unlockDriveUI();
    fetchFiles();
  }
}

function unlockDriveUI() {
  lockModal.classList.add("hidden");
  mainContainer.classList.remove("blurred");
}

function lockDriveUI() {
  lockModal.classList.remove("hidden");
  mainContainer.classList.add("blurred");
  fileList.innerHTML = `<tr><td colspan="4" class="empty-state">Authentication required...</td></tr>`;
  passInput.value = "";
  lockError.classList.add("hidden");
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const enteredPass = passInput.value.trim();
  if (!enteredPass) return;

  unlockBtn.textContent = "Verifying...";
  lockError.classList.add("hidden");

  try {
    const { data, error } = await supabaseClient
      .from("app_config")
      .select("app_password")
      .eq("id", 1)
      .single();

    if (error) throw error;

    if (data && data.app_password === enteredPass) {
      localStorage.setItem("mydrive_unlocked", "true");
      unlockDriveUI();
      fetchFiles();
    } else {
      lockError.textContent = "Incorrect Password!";
      lockError.classList.remove("hidden");
      passInput.value = "";
    }
  } catch (err) {
    console.error("Auth error:", err);
    lockError.textContent = "Error verifying password!";
    lockError.classList.remove("hidden");
  } finally {
    unlockBtn.textContent = "Unlock Drive";
  }
});

logoutBtn.addEventListener("click", () => {
  localStorage.removeItem("mydrive_unlocked");
  lockDriveUI();
});


// 3. FILE SELECTION (ALL TYPES)

dropZone.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", (e) => {
  if (e.target.files && e.target.files.length > 0) {
    handleFileSelect(e.target.files[0]);
  }
});

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.style.borderColor = "var(--text-main)";
});

dropZone.addEventListener("dragleave", () => {
  dropZone.style.borderColor = "var(--border)";
});

dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.style.borderColor = "var(--border)";
  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    handleFileSelect(e.dataTransfer.files[0]);
  }
});

function handleFileSelect(file) {
  selectedFile = file;
  selectedFileName.textContent = `${file.name} (${formatBytes(file.size)})`;
}


// 4. UPLOAD ACTION

uploadBtn.addEventListener("click", async () => {
  if (!selectedFile) {
    fileInput.click();
    return;
  }

  if (!supabaseClient) {
    showMessage("Supabase is not configured properly in app.js!", true);
    return;
  }

  uploadBtn.textContent = "Uploading...";

  const cleanName = selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const fileName = `${Date.now()}_${cleanName}`;

  try {
    const { data, error } = await supabaseClient.storage
      .from(BUCKET_NAME)
      .upload(fileName, selectedFile, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) throw error;

    showMessage("File Uploaded Successfully!");
    resetForm();
    fetchFiles();
  } catch (err) {
    console.error("Upload Error:", err);
    showMessage(`Upload failed: ${err.message}`, true);
  } finally {
    uploadBtn.textContent = "Upload File";
  }
});

function resetForm() {
  selectedFile = null;
  fileInput.value = "";
  selectedFileName.textContent = "No file chosen";
}


// 5. FETCH & RENDER

async function fetchFiles() {
  if (!supabaseClient) return;

  try {
    const { data, error } = await supabaseClient.storage
      .from(BUCKET_NAME)
      .list("", { sortBy: { column: "created_at", order: "desc" } });

    if (error) throw error;

    allFiles = data.filter((item) => item.name !== ".emptyFolderPlaceholder");
    renderFiles(allFiles);
  } catch (err) {
    console.error("Fetch Error:", err);
    fileList.innerHTML = `<tr><td colspan="4" class="empty-state" style="color:red;">Error: ${err.message}</td></tr>`;
  }
}

function renderFiles(files) {
  fileCount.textContent = `${files.length} Files`;

  if (files.length === 0) {
    fileList.innerHTML = `<tr><td colspan="4" class="empty-state">No files found. Click above to upload.</td></tr>`;
    return;
  }

  fileList.innerHTML = files
    .map((file) => {
      const publicUrl = getPublicUrl(file.name);
      const originalName = file.name.substring(file.name.indexOf("_") + 1);
      const createdAt = new Date(file.created_at).toLocaleDateString();

      return `
      <tr>
        <td><strong>${escapeHtml(originalName)}</strong></td>
        <td>${formatBytes(file.metadata ? file.metadata.size : 0)}</td>
        <td>${createdAt}</td>
        <td class="text-right">
          <button class="btn btn-action" onclick="viewFile('${publicUrl}', '${escapeHtml(originalName)}')">View</button>
          <a class="btn btn-action" href="${publicUrl}" target="_blank" download="${originalName}">Download</a>
          <button class="btn btn-action btn-danger" onclick="deleteFile('${file.name}')">Delete</button>
        </td>
      </tr>
    `;
    })
    .join("");
}

searchInput.addEventListener("input", (e) => {
  const query = e.target.value.toLowerCase();
  const filtered = allFiles.filter((file) => file.name.toLowerCase().includes(query));
  renderFiles(filtered);
});

function getPublicUrl(path) {
  const { data } = supabaseClient.storage.from(BUCKET_NAME).getPublicUrl(path);
  return data.publicUrl;
}


// 6. ACTIONS & PREVIEW (SUPPORT ALL FORMATS)

window.deleteFile = async function (filePath) {
  if (!confirm("Are you sure you want to delete this file?")) return;

  try {
    const { error } = await supabaseClient.storage.from(BUCKET_NAME).remove([filePath]);
    if (error) throw error;

    showMessage("File deleted successfully.");
    fetchFiles();
  } catch (err) {
    showMessage(`Failed to delete: ${err.message}`, true);
  }
};

window.viewFile = function (url, title) {
  modalTitle.textContent = title;
  const ext = title.split('.').pop().toLowerCase();

  // img tag
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
    modalBody.innerHTML = `<img src="${url}" style="max-width:100%; max-height:100%; object-fit:contain; margin:auto; display:block;" />`;
  } 
  // video tag
  else if (['mp4', 'webm', 'ogg'].includes(ext)) {
    modalBody.innerHTML = `<video src="${url}" controls style="width:100%; height:100%;"></video>`;
  } 
  // <iframe> for pdf
  else {
    modalBody.innerHTML = `<iframe src="${url}" frameborder="0" style="width:100%; height:100%;"></iframe>`;
  }

  pdfModal.classList.remove("hidden");
};

toggleFullscreenBtn.addEventListener("click", () => {
  modalContent.classList.toggle("is-fullscreen");
});

closeModal.addEventListener("click", () => {
  pdfModal.classList.add("hidden");
  modalBody.innerHTML = "";
  modalContent.classList.remove("is-fullscreen");
});

function formatBytes(bytes, decimals = 2) {
  if (!bytes || bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

function showMessage(msg, isError = false) {
  statusMessage.textContent = msg;
  statusMessage.style.borderColor = isError ? "var(--danger)" : "var(--accent)";
  statusMessage.style.color = isError ? "var(--danger)" : "var(--text-main)";
  statusMessage.classList.remove("hidden");
  setTimeout(() => {
    statusMessage.classList.add("hidden");
  }, 4000);
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (m) => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    }[m];
  });
}

checkSession();