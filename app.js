const queryForm = document.getElementById("queryForm");
const groupInput = document.getElementById("groupInput");
const queryInput = document.getElementById("queryInput");
const statusInput = document.getElementById("statusInput");
const queryList = document.getElementById("queryList");
const emptyMessage = document.getElementById("emptyMessage");
const totalCount = document.getElementById("totalCount");
const pendingCount = document.getElementById("pendingCount");
const groupList = document.getElementById("groupNames");
const savedGroupsLabel = document.getElementById("savedGroups");
const checkInInput = document.getElementById("checkInInput");
const checkOutInput = document.getElementById("checkOutInput");
const mapSearch = document.getElementById("mapSearch");
const mapResults = document.getElementById("mapResults");
const toggleMap = document.getElementById("toggleMap");
const mapEl = document.getElementById("map");

let queryItems = [];
let groupData = {};

function loadQueries() {
    const saved = localStorage.getItem("queryManagerData");
    queryItems = saved ? JSON.parse(saved) : [];
    const savedGroupData = localStorage.getItem("queryManagerGroups");
    groupData = savedGroupData ? JSON.parse(savedGroupData) : {};

    queryItems = queryItems.map((item) => {
        if (!item || typeof item !== "object") {
            return item;
        }

        const normalized = { ...item };
        normalized.rawQuery = normalized.rawQuery || normalized.query || "";
        normalized.formattedQuery = normalized.formattedQuery || normalized.query || normalized.rawQuery;
        normalized.code = normalized.code || generateQueryCode(normalized.group || "unknown");

        let status = normalized.status || "Pending";
        if (status === "پینڈنگ") {
            status = "Pending";
        } else if (status === "جواب دیا گیا") {
            status = "Replied";
        }
        normalized.status = status;
        return normalized;
    });

    updateGroupOptions();
}

function saveQueries() {
    localStorage.setItem("queryManagerData", JSON.stringify(queryItems));
    localStorage.setItem("queryManagerGroups", JSON.stringify(groupData));
}

function getGroupKey(name) {
    return name.trim().toLowerCase();
}

function createGroupMeta(name) {
    const key = getGroupKey(name);
    if (!key) {
        return null;
    }

    if (!groupData[key]) {
        groupData[key] = {
            name: name.trim(),
            nextCode: 1,
        };
    } else {
        groupData[key].name = name.trim();
    }

    return groupData[key];
}

function createGroupCodePrefix(name) {
    const words = name
        .replace(/[^A-Za-z0-9\s]/g, "")
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    let prefix = "";

    if (words.length === 0) {
        prefix = "XX";
    } else if (words.length === 1) {
        const word = words[0];
        prefix = word.length === 1 ? `${word}X` : word.slice(0, 2);
    } else {
        prefix = `${words[0][0]}${words[1][0]}`;
    }

    prefix = prefix.toUpperCase().replace(/[^A-Za-z0-9]/g, "");
    if (prefix.length === 1) {
        prefix = `${prefix}X`;
    }
    if (prefix.length === 0) {
        prefix = "XX";
    }

    return prefix;
}

function generateQueryCode(groupName) {
    const group = createGroupMeta(groupName);
    if (!group) {
        return `XX#${String(Date.now()).slice(-5)}`;
    }

    const codePrefix = createGroupCodePrefix(group.name);
    const code = `${codePrefix}#${String(group.nextCode).padStart(5, "0")}`;

    group.nextCode += 1;
    return code;
}

function updateGroupOptions() {
    if (!groupList || !savedGroupsLabel) {
        return;
    }

    groupList.innerHTML = "";
    const groupNames = Object.values(groupData)
        .map((group) => group.name)
        .sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));

    if (groupNames.length === 0) {
        savedGroupsLabel.textContent = "کوئی گروپ نہیں";
    } else {
        savedGroupsLabel.textContent = groupNames.join("، ");
        groupNames.forEach((name) => {
            const option = document.createElement("option");
            option.value = name;
            groupList.appendChild(option);
        });
    }
}

function formatStatus(status) {
    return status === "Pending" ? "status-pending" : "status-done";
}

function escapeHtml(value) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function renderQueries() {



    // No filters: show all queries (latest first)
    const filtered = queryItems.slice();

    queryList.innerHTML = "";

    if (filtered.length === 0) {
        emptyMessage.style.display = "block";
    } else {
        emptyMessage.style.display = "none";
        filtered.forEach((item) => {
            const card = document.createElement("div");
            card.className = "query-item";
            card.innerHTML = `
        <div class="query-header">
          <strong>${item.group}</strong>
          <div class="status-badge ${formatStatus(item.status)}">${item.status}</div>
        </div>
        <div class="query-meta">
          <span>ID: #${item.id}</span>
          <span>Date: ${item.date}</span>
          <span>Code: ${item.code}</span>
        </div>
        <div class="query-body">${escapeHtml(item.formattedQuery).replace(/\n/g, "<br>")}</div>
      `;

            const actionsRow = document.createElement("div");
            actionsRow.style.marginTop = "14px";
            actionsRow.style.display = "flex";
            actionsRow.style.flexWrap = "wrap";
            actionsRow.style.gap = "10px";

            const toggleButton = document.createElement("button");
            toggleButton.textContent = item.status === "Pending" ? "Mark replied" : "Mark pending";
            toggleButton.style.background = item.status === "Pending" ? "#10b981" : "#f59e0b";
            toggleButton.addEventListener("click", () => {
                item.status = item.status === "Pending" ? "Replied" : "Pending";
                saveQueries();
                renderQueries();
            });

            const deleteButton = document.createElement("button");
            deleteButton.textContent = "Delete";
            deleteButton.style.background = "#ef4444";
            deleteButton.addEventListener("click", () => {
                if (confirm("Do you really want to delete this query?")) {
                    queryItems = queryItems.filter((stored) => stored.id !== item.id);
                    saveQueries();
                    renderQueries();
                }
            });

            actionsRow.append(toggleButton, deleteButton);
            card.appendChild(actionsRow);
            queryList.appendChild(card);
        });
    }

    totalCount.textContent = queryItems.length;
    pendingCount.textContent = queryItems.filter((item) => item.status === "Pending").length;
}

function parseQueryFields(raw) {
    const lines = raw
        .replace(/\r/g, "")
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean);

    let hotel = "";
    let checkIn = "";
    let checkOut = "";
    let roomType = "";
    const usedLines = new Set();

    function isDateLine(line) {
        return parseDateRangeFlexible(line, raw) !== null;
    }

    function isRoomLine(line) {
        return /\b(bed|suite|room|quad|double|single|king|queen|family|deluxe|standard|studio)\b/i.test(line);
    }

    function isHotelLine(line) {
        return /\b(hotel|tower|resort|inn|lodge|makkah)\b/i.test(line) || (!isDateLine(line) && !isRoomLine(line) && line.length > 2);
    }

    for (const line of lines) {
        if (!checkIn && !checkOut) {
            const parsedDates = parseDateRange(line);
            if (parsedDates) {
                checkIn = parsedDates.checkIn;
                checkOut = parsedDates.checkOut;
                usedLines.add(line);
                continue;
            }
        }

        if (!hotel && isHotelLine(line)) {
            hotel = line;
            usedLines.add(line);
            continue;
        }

        if (!roomType && isRoomLine(line)) {
            roomType = line;
            usedLines.add(line);
            continue;
        }
    }

    const leftover = lines.filter((line) => !usedLines.has(line));
    if (!hotel && leftover.length > 0) {
        hotel = leftover.shift();
    }

    if (!roomType && leftover.length > 0) {
        roomType = leftover.pop();
    }

    return {
        hotel,
        checkIn,
        checkOut,
        roomType,
    };
}

function parseDateRangeFlexible(line, allText) {
    // Try regular parsing first
    const exact = parseDateRange(line);
    if (exact) return exact;

    // Fallback: match simple numeric range like "23 - 24" and try to find month from allText
    const simpleRange = line.match(/(\d{1,2})\s*(?:to|To|TO|تا|-)\s*(\d{1,2})/);
    if (!simpleRange) return null;

    const [, d1, d2] = simpleRange;
    const monthToken = findMonthFromText(allText || line);
    const year = findYearFromText(allText || line) || new Date().getFullYear();
    const month = normalizeMonthName(monthToken);
    if (!month) return null;

    return {
        checkIn: `${String(Number(d1)).padStart(2, "0")}/${month}/${year}`,
        checkOut: `${String(Number(d2)).padStart(2, "0")}/${month}/${year}`,
    };
}

function parseDateRange(line) {
    const text = line
        .replace(/[–—]/g, "-")
        .replace(/،/g, " ")
        .replace(/\//g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const datePattern = /(\d{1,2})(?:\s*([A-Za-z]{3,4}))?\s*(?:to|To|TO|تا|-)\s*(\d{1,2})(?:\s*([A-Za-z]{3,4}))?/;
    const match = text.match(datePattern);
    if (!match) {
        return null;
    }

    const [, day1, month1, day2, month2] = match;
    const year = findYearFromText(text) || new Date().getFullYear();

    // Determine month tokens for each date separately.
    const monthToken1 = month1 || findMonthFromText(text);
    const monthToken2 = month2 || month1 || findMonthFromText(text);

    const monthNorm1 = normalizeMonthName(monthToken1);
    const monthNorm2 = normalizeMonthName(monthToken2);

    // If either month couldn't be resolved, fail parsing.
    if (!monthNorm1 && !monthNorm2) return null;

    // If one normalized month is missing, fall back to the other.
    const m1 = monthNorm1 || monthNorm2;
    const m2 = monthNorm2 || monthNorm1;

    return {
        checkIn: `${String(Number(day1)).padStart(2, "0")}/${m1}/${year}`,
        checkOut: `${String(Number(day2)).padStart(2, "0")}/${m2}/${year}`,
    };
}

function normalizeMonthName(token) {
    if (!token) {
        return null;
    }

    const map = {
        jan: "Jan",
        feb: "Feb",
        mar: "Mar",
        apr: "Apr",
        may: "May",
        jun: "Jun",
        jul: "Jul",
        aug: "Aug",
        sep: "Sep",
        sept: "Sep",
        oct: "Oct",
        nov: "Nov",
        dec: "Dec",
    };

    const key = token.trim().slice(0, 3).toLowerCase();
    return map[key] || null;
}

function findMonthFromText(text) {
    const monthMatch = text.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\b/i);
    return monthMatch ? monthMatch[1] : null;
}

function findYearFromText(text) {
    const yearMatch = text.match(/\b(20\d{2})\b/);
    return yearMatch ? yearMatch[1] : null;
}

function formatQueryText(raw, code) {
    const parsed = parseQueryFields(raw);
    const lines = [];
    if (code) {
        lines.push(`*Code* ${code}`);
    }

    if (parsed.hotel) {
        if (/makkah/i.test(parsed.hotel)) {
            lines.push(`*Makkah Hotel:* ${parsed.hotel}`);
        } else {
            lines.push(`*Hotel:* ${parsed.hotel}`);
        }
    }
    if (parsed.checkIn) {
        lines.push(`* Check → In:* ${parsed.checkIn}`);
    }
    if (parsed.checkOut) {
        lines.push(`* Check → Out:* ${parsed.checkOut}`);
    }
    if (parsed.roomType) {
        lines.push(`*Room Type:* ${parsed.roomType}`);
    }

    if (!parsed.hotel && !parsed.checkIn && !parsed.checkOut && !parsed.roomType) {
        lines.push(raw.trim());
    }

    return lines.join("\n");
}

function formatDatesFromInputs(checkInISO, checkOutISO) {
    if (!checkInISO && !checkOutISO) return {};
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    let ci = "", co = "";
    if (checkInISO) {
        const d = new Date(checkInISO);
        ci = `${String(d.getDate()).padStart(2, '0')}/${months[d.getMonth()]}/${d.getFullYear()}`;
    }
    if (checkOutISO) {
        const d = new Date(checkOutISO);
        co = `${String(d.getDate()).padStart(2, '0')}/${months[d.getMonth()]}/${d.getFullYear()}`;
    }
    return { checkIn: ci, checkOut: co };
}

function addQuery(event) {
    event.preventDefault();

    const groupName = groupInput.value.trim();
    const rawText = queryInput.value.trim();

    if (!groupName || !rawText) {
        alert("Please fill in all required fields.");
        return;
    }

    const code = generateQueryCode(groupName);
    // If user provided date inputs, use them to build structured formattedQuery
    let formatted = "";
    const dates = formatDatesFromInputs(checkInInput && checkInInput.value ? checkInInput.value : null, checkOutInput && checkOutInput.value ? checkOutInput.value : null);
    if (dates.checkIn || dates.checkOut) {
        const parsed = parseQueryFields(rawText);
        const lines = [];
        if (code) lines.push(`*Code* ${code}`);
        if (groupName) {
            if (/makkah/i.test(groupName)) lines.push(`*Makkah Hotel:* ${groupName}`);
            else lines.push(`*Hotel:* ${groupName}`);
        }
        if (dates.checkIn) lines.push(`* Check → In:* ${dates.checkIn}`);
        if (dates.checkOut) lines.push(`* Check → Out:* ${dates.checkOut}`);
        if (parsed.roomType) lines.push(`*Room Type:* ${parsed.roomType}`);
        formatted = lines.join("\n");
    } else {
        formatted = formatQueryText(rawText, code);
    }

    const newQuery = {
        id: Date.now(),
        group: groupName,
        rawQuery: rawText,
        formattedQuery: formatted,
        code,
        status: statusInput.value,
        date: new Date().toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
        }),
    };

    queryItems.unshift(newQuery);
    saveQueries();
    updateGroupOptions();
    renderQueries();

    queryForm.reset();
    statusInput.value = "Pending";
}

queryForm.addEventListener("submit", addQuery);

// debounce helper
function debounce(fn, wait = 300) {
    let t;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), wait);
    };
}

// Map and search functionality using Nominatim + Leaflet
let mapObj = null;
let markersLayer = null;
let lastMarker = null;

function initMap() {
    if (!mapEl) return;
    mapEl.style.display = 'block';
    mapEl.style.height = '300px';
    mapObj = L.map(mapEl).setView([21.3891, 39.8579], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
    }).addTo(mapObj);
    markersLayer = L.layerGroup().addTo(mapObj);
}

function showSearchResults(results) {
    mapResults.innerHTML = '';
    results.forEach((r) => {
        const btn = document.createElement('button');
        btn.textContent = r.display_name;
        btn.addEventListener('click', () => {
            groupInput.value = r.display_name.split(',')[0];
            // store lat/lon in group meta
            const meta = createGroupMeta(groupInput.value);
            if (meta) meta.location = { lat: parseFloat(r.lat), lon: parseFloat(r.lon) };
            updateGroupOptions();
            if (mapObj) {
                markersLayer.clearLayers();
                lastMarker = L.marker([r.lat, r.lon]).addTo(markersLayer);
                mapObj.setView([r.lat, r.lon], 14);
            }
        });
        mapResults.appendChild(btn);
    });
}

const doSearch = debounce(async (q) => {
    if (!q || q.length < 2) { mapResults.innerHTML = ''; return; }
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=6&addressdetails=1`;
    try {
        const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
        const data = await res.json();
        showSearchResults(data);
    } catch (e) {
        console.error('Search failed', e);
    }
}, 350);

if (mapSearch) mapSearch.addEventListener('input', (e) => doSearch(e.target.value));
if (toggleMap) toggleMap.addEventListener('click', () => {
    if (!mapObj) initMap();
    if (mapEl.style.display === 'none' || mapEl.style.height === '0px' || mapEl.style.height === '') {
        mapEl.style.display = 'block'; mapEl.style.height = '300px'; toggleMap.textContent = 'Hide map'; if (mapObj) mapObj.invalidateSize();
    } else { mapEl.style.display = 'none'; mapEl.style.height = '0'; toggleMap.textContent = 'Show map'; }
});

loadQueries();
renderQueries();
