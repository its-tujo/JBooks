// =======================
// Modal Functions
// =======================
function openAddEntryModal() {
    const modal = document.getElementById("addEntryModal");
    modal.classList.remove("hidden");
    setTimeout(() => {
        modal.classList.add("bg-opacity-50");
        const inner = modal.querySelector("div");
        inner.classList.remove("scale-95", "opacity-0");
        inner.classList.add("scale-100", "opacity-100");
    }, 10);
}

function closeAddEntryModal() {
    const modal = document.getElementById("addEntryModal");
    const inner = modal.querySelector("div");
    inner.classList.remove("scale-100", "opacity-100");
    inner.classList.add("scale-95", "opacity-0");
    modal.classList.remove("bg-opacity-50");
    setTimeout(() => { modal.classList.add("hidden"); }, 300);
}

// =======================
// ISBN Formatting & Validation
// =======================
function formatISBN(input) {
    let val = input.value.replace(/\D/g, "");
    if (!val.startsWith("978") && val.length > 0) val = "978" + val;
    input.value = val;
}

function validateISBN() {
    const val = document.getElementById("isbn").value.replace(/\D/g, "");
    if (!val.startsWith("978") || val.length !== 13) {
        Swal.fire({
            icon: "error",
            title: "Invalid ISBN",
            text: "ISBN must be 13 digits starting with 978",
            toast: true,
            position: "top-end",
            showConfirmButton: false,
            timer: 3000
        });
        return false;
    }
    return true;
}

// =======================
// Location Update
// =======================
let locationUpdateTimeout;
function updateLocation(isbn, location) {
    fetch(`/api/entries/${encodeURIComponent(isbn)}/location`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location })
    })
    .then(res => res.json())
    .then(res => {
        if (res.error) {
            console.error("Error updating location:", res.error);
            Swal.fire({ icon: "error", title: "Update Failed", text: "Could not update location", toast: true, position: "top-end", showConfirmButton: false, timer: 3000 });
        } else {
            Swal.fire({ icon: "success", title: "Location Updated", text: "Location has been saved successfully", toast: true, position: "top-end", showConfirmButton: false, timer: 2000 });
        }
    }).catch(err => console.error("Error updating location:", err));
}

function debouncedUpdateLocation(isbn, value) {
    clearTimeout(locationUpdateTimeout);
    locationUpdateTimeout = setTimeout(() => updateLocation(isbn, value), 1000);
}

// =======================
// Fetch & Search Entries
// =======================
let searchTimeout;
function fetchEntries(query = "") {
    let url = "/api/entries";
    if (query) url += `?search=${encodeURIComponent(query)}`;
    fetch(url)
        .then(res => res.json())
        .then(entries => {
            const tbody = document.getElementById("entriesTableBody");
            tbody.innerHTML = "";
            entries.forEach(e => {
                const tr = document.createElement("tr");
                tr.className = "hover:bg-gray-50 transition-colors duration-150";
                tr.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${e.name}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${e.isbn}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <input type="text"
                               value="${e.location || ""}"
                               class="location-input border rounded px-2 py-1 text-sm w-full"
                               data-isbn="${e.isbn}"
                               oninput="debouncedUpdateLocation('${e.isbn}', this.value)">
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${e.author}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ${e.summary && e.summary.length > 30 ? `<button onclick="openDescriptionModal('${e.summary.replace(/'/g,"\\'")}')" class="text-blue-500 hover:underline">Read description</button>` : e.summary || "-"}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${e.pages}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${e.language}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${e.publishedDate}</td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <img src="${e.imageUrl || "http://static.photos/books/200x200"}"
                             alt="Book cover"
                             class="w-10 h-14 object-cover rounded hover:scale-105 transition-transform duration-200 cursor-pointer"
                             onclick="openImageModal('${e.imageUrl || "http://static.photos/books/200x200"}')">
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <button onclick="deleteEntryByISBN('${e.isbn}')" class="text-red-500 hover:text-red-700">
                            <i data-feather="trash-2" class="w-4 h-4"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
            feather.replace();
        }).catch(err => console.error("Error fetching entries:", err));
}

function searchEntries() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        const query = document.getElementById("searchInput").value.trim();
        fetchEntries(query);
    }, 300);
}

// =======================
// Delete Entry
// =======================
function deleteEntryByISBN(isbn) {
    Swal.fire({
        title: "Delete Book",
        text: "Are you sure you want to delete this book?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#3085d6",
        cancelButtonColor: "#d33",
        confirmButtonText: "Yes, delete it!",
        cancelButtonText: "Cancel",
        reverseButtons: true
    }).then(res => {
        if (!res.isConfirmed) return;
        fetch(`/api/entries/isbn/${encodeURIComponent(isbn)}`, { method: "DELETE", headers: { "Content-Type": "application/json" }})
            .then(res => res.json())
            .then(res => {
                Swal.fire({ icon: "success", title: "Deleted!", text: res.message || "Book deleted successfully", toast: true, position: "top-end", showConfirmButton: false, timer: 3000 });
                fetchEntries();
            })
            .catch(err => Swal.fire({ icon: "error", title: "Error", text: "Failed to delete book", toast: true, position: "top-end", showConfirmButton: false, timer: 3000 }));
    });
}

// =======================
// Image & Description Modal
// =======================
function openImageModal(url) {
    const modal = document.createElement("div");
    modal.className = "fixed inset-0 bg-black bg-opacity-0 flex items-center justify-center z-50 p-4 transition-opacity duration-300 ease-in-out";
    modal.innerHTML = `
        <div class="relative max-w-4xl w-full transform transition-all duration-300 ease-in-out scale-95 opacity-0">
            <img src="${url}" alt="Book cover" class="w-full max-h-[90vh] object-contain">
            <button onclick="this.parentElement.parentElement.remove()"
                    class="absolute top-4 right-4 text-white text-2xl hover:text-gray-300">&times;</button>
        </div>
    `;
    document.body.appendChild(modal);
    setTimeout(() => {
        modal.classList.add("bg-opacity-75");
        modal.querySelector("div").classList.remove("scale-95", "opacity-0");
        modal.querySelector("div").classList.add("scale-100", "opacity-100");
    }, 10);
}

function openDescriptionModal(text) {
    const modal = document.createElement("div");
    modal.className = "fixed inset-0 bg-black bg-opacity-0 flex items-center justify-center z-50 p-4 transition-opacity duration-300 ease-in-out";
    modal.innerHTML = `
        <div class="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto transform transition-all duration-300 ease-in-out scale-95 opacity-0">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-medium">Book Description</h3>
                <button onclick="this.parentElement.parentElement.parentElement.remove()" class="text-gray-400 hover:text-gray-500">
                    <i data-feather="x" class="w-5 h-5"></i>
                </button>
            </div>
            <p class="text-gray-700 whitespace-pre-wrap">${text}</p>
        </div>
    `;
    document.body.appendChild(modal);
    setTimeout(() => {
        modal.classList.add("bg-opacity-75");
        modal.querySelector("div").classList.remove("scale-95", "opacity-0");
        modal.querySelector("div").classList.add("scale-100", "opacity-100");
    }, 10);
    feather.replace();
}

// =======================
// Add Entry Form
// =======================
document.getElementById("isbn").addEventListener("input", e => formatISBN(e.target));
document.getElementById("isbnForm").addEventListener("submit", function(e){
    e.preventDefault();
    if (!validateISBN()) return;
    const isbn = document.getElementById("isbn").value.replace(/\D/g,"");
    const location = document.getElementById("location").value;
    fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isbn, location })
    }).then(res => res.ok ? res.json() : res.json().then(r => { throw r; }))
      .then(data => {
          Swal.fire({ icon:"success", title:"Success", text:data.message, toast:true, position:"top-end", showConfirmButton:false, timer:2000 });
          fetchEntries();
          closeAddEntryModal();
          document.getElementById("isbn").value = "";
          document.getElementById("location").value = "";
      }).catch(err => {
          Swal.fire({ icon:"error", title:"Error", text: err.error || "An error occurred while adding the book", toast:true, position:"top-end", showConfirmButton:false, timer:3000 });
      });
});

// =======================
// Quagga2 Scanner
// =======================
let quaggaStarted = false;

function openScannerModal() {
    const modal = document.getElementById("scannerModal");
    modal.classList.remove("hidden");
    setTimeout(() => {
        modal.classList.add("bg-opacity-50");
        const inner = modal.querySelector("div");
        inner.classList.remove("scale-95", "opacity-0");
        inner.classList.add("scale-100", "opacity-100");
    }, 10);
    if (!quaggaStarted) startScanner();
}

function startScanner() {
    const videoElem = document.getElementById("scanner");
    Quagga.init({
        inputStream: { type: "LiveStream", target: videoElem, constraints: { facingMode: "environment" } },
        decoder: { readers: ["ean_reader"] },
        locate: true
    }, function(err) {
        if (err) { console.error(err); Swal.fire("Error", err.message, "error"); return; }
        Quagga.start();
        quaggaStarted = true;
        Quagga.onDetected(handleScan);
    });
}

function handleScan(result) {
    const isbn = result.codeResult.code;
    if (/^97[89]\d{10}$/.test(isbn)) {
        fetch("/api/entries", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isbn, location: "N/A" })
        }).then(res => res.ok ? res.json() : res.json().then(r => { throw r; }))
          .then(data => {
              Swal.fire({ toast:true, position:"top-end", icon:"success", title:`Added: ${data.name}`, showConfirmButton:false, timer:2000 });
              fetchEntries();
          }).catch(err => Swal.fire({ toast:true, position:"top-end", icon:"error", title:err.error||"Failed to add", showConfirmButton:false, timer:2000 }));
    } else {
        Swal.fire({ toast:true, position:"top-end", icon:"warning", title:"Not a valid ISBN-13", showConfirmButton:false, timer:2000 });
    }
}

function closeScannerModal() {
    const modal = document.getElementById("scannerModal");
    modal.classList.add("hidden");
    const inner = modal.querySelector("div");
    inner.classList.add("scale-95","opacity-0");
    if (quaggaStarted) {
        Quagga.stop();
        Quagga.offDetected(handleScan);
        quaggaStarted = false;
    }
}

// =======================
// Init
// =======================
AOS.init({ duration: 600, easing: "ease-out-quad", once: true });
feather.replace();
document.addEventListener("DOMContentLoaded", () => {
    fetchEntries();
    setInterval(fetchEntries, 10000);
    document.getElementById("searchInput").addEventListener("input", searchEntries);
    document.getElementById("searchInput").addEventListener("keypress", e => { if(e.key==="Enter") searchEntries(); });
});
