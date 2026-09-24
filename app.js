
"use strict";

// ============================================
// 1. EVENT DATA
// ============================================

const events = [
  {
    id: 1,
    name: "Live Music Fest 2026",
    category: "Music",
    date: "2026-10-16",
    time: "6:00 PM – 11:00 PM",
    location: "Riverside Arena, Nashik",
    description: "An electrifying night with top artists, great food and unforgettable vibes!",
    emoji: "🎸"
  },
  {
    id: 2,
    name: "Tech Innovators Summit",
    category: "Tech",
    date: "2026-10-23",
    time: "9:00 AM – 5:00 PM",
    location: "Convention Center, Nashik",
    description: "Meet industry leaders, explore new technologies and build your network.",
    emoji: "💻"
  },
  {
    id: 3,
    name: "Creative Writing Workshop",
    category: "Workshops",
    date: "2026-10-30",
    time: "10:00 AM – 1:00 PM",
    location: "The Learning Hub, Nashik",
    description: "Unlock your creativity and learn storytelling techniques from experts.",
    emoji: "✍️"
  },
  {
    id: 4,
    name: "Food Carnival 2026",
    category: "Food & Drink",
    date: "2026-11-06",
    time: "12:00 PM – 10:00 PM",
    location: "City Grounds, Nashik",
    description: "Taste delicious food, enjoy live music and have a great time with friends!",
    emoji: "🍔"
  },
  {
    id: 5,
    name: "Nashik Cycling Challenge",
    category: "Sports",
    date: "2026-11-14",
    time: "6:00 AM – 11:00 AM",
    location: "Gangapur Dam, Nashik",
    description: "An exciting cycling event for all fitness enthusiasts. All are welcome!",
    emoji: "🚴"
  },
  {
    id: 6,
    name: "Art & Culture Exhibition",
    category: "Arts",
    date: "2026-11-20",
    time: "10:00 AM – 6:00 PM",
    location: "Nashik Art Gallery",
    description: "Explore beautiful artworks, meet artists and experience local culture.",
    emoji: "🎨"
  },
  {
    id: 7,
    name: "24-Hour Hackathon",
    category: "Tech",
    date: "2026-11-27",
    time: "9:00 AM – 9:00 AM (Next Day)",
    location: "IT Campus, Nashik",
    description: "Build innovative solutions, win prizes and be part of something big!",
    emoji: "🚀"
  },
  {
    id: 8,
    name: "Wellness Retreat",
    category: "Others",
    date: "2026-12-05",
    time: "8:00 AM – 5:00 PM",
    location: "Nature's Nest, Nashik",
    description: "Relax, recharge and focus on your well-being.",
    emoji: "🧘"
  }
];

// ============================================
// 2. DOM ELEMENTS AND STATE
// ============================================

const $ = id => document.getElementById(id);

const searchInput = $("searchInput");
const categoryFilter = $("categoryFilter");
const dateFilter = $("dateFilter");
const sortFilter = $("sortFilter");
const eventGrid = $("eventGrid");
const noResults = $("noResults");
const resultCount = $("resultCount");
const tabs = document.querySelectorAll(".tab");

let currentUser = null;
let showSavedOnly = false;
const savedEvents = new Set();

let authMode = "login";

// ============================================
// 3. API HELPER
// ============================================

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    credentials: "same-origin",
    headers: {
      ...(options.body
        ? { "Content-Type": "application/json" }
        : {}),
      ...options.headers
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Something went wrong.");
  }

  return data;
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function formatDate(dateString) {
  return new Date(dateString + "T12:00:00")
    .toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
}

function toast(message) {
  const element = $("toast");
  element.textContent = message;
  element.classList.add("show");

  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => {
    element.classList.remove("show");
  }, 3000);
}

// ============================================
// 4. AUTHENTICATION UI
// ============================================

function updateAuthUI() {
  const signedIn = Boolean(currentUser);

  $("userWelcome").textContent = signedIn
    ? `Welcome, ${currentUser.name}`
    : "Welcome, Guest";

  $("signInBtn").hidden = signedIn;
  $("registerBtn").hidden = signedIn;
  $("signOutBtn").hidden = !signedIn;
  $("myApplicationsBtn").hidden = !signedIn;

  $("organizerBtn").hidden =
    !signedIn || currentUser.role !== "organizer";

  renderEvents();
}

function openAuth(mode) {
  authMode = mode;
  $("authForm").reset();
  $("authMessage").textContent = "";

  const isRegister = mode === "register";

  $("authTitle").textContent =
    isRegister ? "Create Account" : "Sign In";

  $("authSubmit").textContent =
    isRegister ? "Register" : "Sign In";

  $("nameField").hidden = !isRegister;
  $("authName").required = isRegister;

  $("authPassword").autocomplete =
    isRegister ? "new-password" : "current-password";

  $("authSwitchText").textContent =
    isRegister ? "Already have an account?" :
      "Don't have an account?";

  $("authSwitchBtn").textContent =
    isRegister ? "Sign In" : "Register";

  $("authDialog").showModal();
}

$("signInBtn").addEventListener("click", () => openAuth("login"));
$("registerBtn").addEventListener("click", () => openAuth("register"));

$("authSwitchBtn").addEventListener("click", () => {
  openAuth(authMode === "login" ? "register" : "login");
});

$("authForm").addEventListener("submit", async event => {
  event.preventDefault();

  const message = $("authMessage");
  const submit = $("authSubmit");

  message.textContent = "";
  submit.disabled = true;

  try {
    const isRegister = authMode === "register";

    const data = await api(
      isRegister ? "/api/auth/register" : "/api/auth/login",
      {
        method: "POST",
        body: JSON.stringify({
          name: $("authName").value.trim(),
          email: $("authEmail").value.trim(),
          password: $("authPassword").value
        })
      }
    );

    currentUser = data.user;
    $("authDialog").close();
    updateAuthUI();
    toast(isRegister ? "Account created!" : "Signed in successfully!");
  } catch (error) {
    message.textContent = error.message;
  } finally {
    submit.disabled = false;
  }
});

$("signOutBtn").addEventListener("click", async () => {
  try {
    await api("/api/auth/logout", { method: "POST" });
    currentUser = null;
    showSavedOnly = false;
    $("applicationsPanel").hidden = true;
    $("organizerPanel").hidden = true;
    updateAuthUI();
    toast("You have signed out.");
  } catch (error) {
    toast(error.message);
  }
});

// ============================================
// 5. SEARCH, FILTER AND SORT
// ============================================

function getFilteredEvents() {
  const keyword = searchInput.value.trim().toLowerCase();
  const category = categoryFilter.value;
  const dateOption = dateFilter.value;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  const filtered = events.filter(event => {
    const eventDate = new Date(event.date + "T12:00:00");

    const matchesKeyword = [
      event.name,
      event.category,
      event.location,
      event.description
    ].some(value => value.toLowerCase().includes(keyword));

    const matchesCategory =
      category === "all" || event.category === category;

    let matchesDate = true;

    if (dateOption === "upcoming") {
      matchesDate = eventDate >= today;
    } else if (dateOption === "past") {
      matchesDate = eventDate < today;
    } else if (dateOption === "thisMonth") {
      matchesDate =
        eventDate.getMonth() === currentMonth &&
        eventDate.getFullYear() === currentYear;
    }

    const matchesSaved =
      !showSavedOnly || savedEvents.has(event.id);

    return matchesKeyword &&
      matchesCategory &&
      matchesDate &&
      matchesSaved;
  });

  switch (sortFilter.value) {
    case "nearest":
      filtered.sort((a, b) => a.date.localeCompare(b.date));
      break;
    case "farthest":
      filtered.sort((a, b) => b.date.localeCompare(a.date));
      break;
    case "az":
      filtered.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "za":
      filtered.sort((a, b) => b.name.localeCompare(a.name));
      break;
  }

  return filtered;
}

function updateActiveTab() {
  tabs.forEach(tab => {
    tab.classList.toggle(
      "active",
      tab.dataset.category === categoryFilter.value
    );
  });
}

searchInput.addEventListener("input", renderEvents);
categoryFilter.addEventListener("change", () => {
  updateActiveTab();
  renderEvents();
});
dateFilter.addEventListener("change", renderEvents);
sortFilter.addEventListener("change", renderEvents);

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    categoryFilter.value = tab.dataset.category;
    updateActiveTab();
    renderEvents();
  });
});

function clearFilters() {
  searchInput.value = "";
  categoryFilter.value = "all";
  dateFilter.value = "all";
  sortFilter.value = "nearest";
  showSavedOnly = false;
  updateActiveTab();
  renderEvents();
}

$("clearBtn").addEventListener("click", clearFilters);
$("emptyClearBtn").addEventListener("click", clearFilters);

$("savedToggle").addEventListener("click", () => {
  showSavedOnly = !showSavedOnly;
  renderEvents();
});

// ============================================
// 6. EVENT CARDS AND APPLICATION STATUS
// ============================================

const applicationStatus = new Map();

function createEventCard(event) {
  const saved = savedEvents.has(event.id);
  const status = applicationStatus.get(event.id);

  const applyText = status
    ? status === "pending"
      ? "Application Pending"
      : `Application ${status}`
    : "Apply Now";

  const applyDisabled =
    !currentUser || Boolean(status);

  return `
    <article class="event-card">
      <div class="event-image">
        <span class="image-emoji">${event.emoji}</span>
        <span class="category-badge">
          ${escapeHTML(event.category)}
        </span>
        <span class="date-badge">
          ${formatDate(event.date)}
        </span>
      </div>

      <div class="card-content">
        <h3>${escapeHTML(event.name)}</h3>

        <div class="event-info">
          <span>▣ ${formatDate(event.date)}</span>
          <span>◷ ${escapeHTML(event.time)}</span>
          <span>⌖ ${escapeHTML(event.location)}</span>
        </div>

        <p class="event-description">
          ${escapeHTML(event.description)}
        </p>

        <div class="card-actions">
          <button class="details-btn"
            data-action="details" data-id="${event.id}">
            View Details →
          </button>

          <button class="save-btn ${saved ? "saved" : ""}"
            data-action="save" data-id="${event.id}">
            ${saved ? "♥ Saved" : "♡ Save"}
          </button>
        </div>

        <button class="apply-btn"
          data-action="apply" data-id="${event.id}"
          ${applyDisabled ? "disabled" : ""}>
          ${currentUser && status ? applyText :
            currentUser ? "Apply for Event" : "Sign In to Apply"}
        </button>
      </div>
    </article>
  `;
}

function renderEvents() {
  const filtered = getFilteredEvents();

  eventGrid.innerHTML = filtered.map(createEventCard).join("");
  eventGrid.hidden = filtered.length === 0;
  noResults.hidden = filtered.length !== 0;

  resultCount.textContent =
    `Showing ${filtered.length} of ${events.length} events`;

  $("savedCount").textContent = savedEvents.size;
}

// ============================================
// 7. EVENT DETAILS AND APPLY
// ============================================

function openDetails(event) {
  $("detailsContent").innerHTML = `
    <div class="detail-emoji">${event.emoji}</div>
    <h3>${escapeHTML(event.name)}</h3>
    <p><strong>Category:</strong> ${escapeHTML(event.category)}</p>
    <p><strong>Date:</strong> ${formatDate(event.date)}</p>
    <p><strong>Time:</strong> ${escapeHTML(event.time)}</p>
    <p><strong>Location:</strong> ${escapeHTML(event.location)}</p>
    <p>${escapeHTML(event.description)}</p>
    <button class="primary-btn"
      data-detail-apply="${event.id}">
      Apply for Event
    </button>
  `;

  $("detailsDialog").showModal();
}

function openApplication(event) {
  if (!currentUser) {
    openAuth("login");
    toast("Please sign in before applying.");
    return;
  }

  $("applyForm").reset();
  $("applyMessage").textContent = "";
  $("applyEventId").value = event.id;
  $("applyEventName").textContent = event.name;
  $("applicantName").value = currentUser.name;

  $("applyDialog").showModal();
}

eventGrid.addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const id = Number(button.dataset.id);
  const selected = events.find(item => item.id === id);

  if (!selected) return;

  switch (button.dataset.action) {
    case "save":
      if (savedEvents.has(id)) {
        savedEvents.delete(id);
      } else {
        savedEvents.add(id);
      }
      renderEvents();
      break;

    case "details":
      openDetails(selected);
      break;

    case "apply":
      openApplication(selected);
      break;
  }
});

$("detailsContent").addEventListener("click", event => {
  const button = event.target.closest("[data-detail-apply]");
  if (!button) return;

  const selected = events.find(
    item => item.id === Number(button.dataset.detailApply)
  );

  if (selected) {
    $("detailsDialog").close();
    openApplication(selected);
  }
});

$("applyForm").addEventListener("submit", async event => {
  event.preventDefault();

  const submit = $("applyForm").querySelector("button[type=submit]");
  const message = $("applyMessage");

  submit.disabled = true;
  message.textContent = "";

  try {
    const eventId = Number($("applyEventId").value);

    const data = await api("/api/applications", {
      method: "POST",
      body: JSON.stringify({
        eventId,
        fullName: $("applicantName").value.trim(),
        phone: $("applicantPhone").value.trim(),
        notes: $("applicantNotes").value.trim()
      })
    });

    applicationStatus.set(eventId, data.application.status);
    $("applyDialog").close();
    renderEvents();
    toast("Your application was submitted!");
  } catch (error) {
    message.textContent = error.message;
  } finally {
    submit.disabled = false;
  }
});

// ============================================
// 8. MY APPLICATIONS
// ============================================

$("myApplicationsBtn").addEventListener("click", loadMyApplications);

async function loadMyApplications() {
  try {
    const data = await api("/api/applications/mine");

    $("applicationsPanel").hidden = false;
    $("organizerPanel").hidden = true;

    $("myApplicationsList").innerHTML =
      data.applications.length
        ? data.applications.map(app => `
          <div class="app-row">
            <div>
              <h3>${escapeHTML(app.event_name)}</h3>
              <p>Applied: ${new Date(app.created_at).toLocaleDateString()}</p>
              <p>Status: <strong>${escapeHTML(app.status)}</strong></p>
            </div>
          </div>
        `).join("")
        : "<p>You haven't applied for any events yet.</p>";

    applicationStatus.clear();

    data.applications.forEach(app => {
      applicationStatus.set(app.event_id, app.status);
    });

    renderEvents();
  } catch (error) {
    toast(error.message);
  }
}

// ============================================
// 9. ORGANIZER DASHBOARD
// ============================================

$("organizerBtn").addEventListener("click", openOrganizerDashboard);

async function openOrganizerDashboard() {
  if (!currentUser || currentUser.role !== "organizer") {
    toast("Organizer access required.");
    return;
  }

  $("organizerPanel").hidden = false;
  $("applicationsPanel").hidden = true;

  const selector = $("organizerEventFilter");

  selector.innerHTML = '<option value="">All Events</option>' +
    events.map(event => `
      <option value="${event.id}">
        ${escapeHTML(event.name)}
      </option>
    `).join("");

  await loadApplicants();
}

$("organizerEventFilter").addEventListener("change", loadApplicants);

async function loadApplicants() {
  const eventId = $("organizerEventFilter").value;

  try {
    const query = eventId
      ? `?eventId=${encodeURIComponent(eventId)}`
      : "";

    const data = await api("/api/organizer/applications" + query);

    $("applicantList").innerHTML = data.applications.length
      ? data.applications.map(app => `
        <div class="applicant-row">
          <div>
            <h3>${escapeHTML(app.full_name)}</h3>
            <p>${escapeHTML(app.email)}</p>
            <p>${escapeHTML(app.phone)}</p>
            <p>Event: ${escapeHTML(app.event_name)}</p>
            <p>Notes: ${escapeHTML(app.notes || "None")}</p>
            <p>Status: <strong>${escapeHTML(app.status)}</strong></p>
            <p>Applied: ${new Date(app.created_at).toLocaleString()}</p>
          </div>

          <div class="applicant-actions">
            <button class="approve-btn"
              data-status="approved"
              data-id="${app.id}">
              Approve
            </button>
            <button class="reject-btn"
              data-status="rejected"
              data-id="${app.id}">
              Reject
            </button>
          </div>
        </div>
      `).join("")
      : "<p>No applicants found for this event.</p>";

  } catch (error) {
    toast(error.message);
  }
}

$("applicantList").addEventListener("click", async event => {
  const button = event.target.closest("[data-status]");
  if (!button) return;

  try {
    await api(
      `/api/organizer/applications/${button.dataset.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          status: button.dataset.status
        })
      }
    );

    toast("Application status updated.");
    await loadApplicants();
  } catch (error) {
    toast(error.message);
  }
});

// ============================================
// 10. MODAL AND PANEL CLOSE HANDLERS
// ============================================

document.querySelectorAll("[data-close-dialog]").forEach(button => {
  button.addEventListener("click", () => {
    $(button.dataset.closeDialog).close();
  });
});

document.querySelectorAll("[data-close]").forEach(button => {
  button.addEventListener("click", () => {
    $(button.dataset.close).hidden = true;
  });
});

// ============================================
// 11. INITIAL SESSION CHECK
// ============================================

async function initialize() {
  try {
    const data = await api("/api/auth/me");
    currentUser = data.user;
  } catch (error) {
    currentUser = null;
  }

  updateAuthUI();
}

initialize();