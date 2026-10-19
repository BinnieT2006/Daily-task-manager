
"use strict";

/* =========================================
   DAYFLOW — DAILY TASK MANAGER
   Task management, filters, storage and UI
========================================= */

const STORAGE_KEY = "dayflow_tasks_v1";
const THEME_KEY = "dayflow_theme_v1";

// DOM helpers
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const elements = {
    sidebar: $("#sidebar"),
    menuToggle: $("#menuToggle"),
    themeToggle: $("#themeToggle"),
    themeIcon: $("#themeIcon"),
    themeText: $("#themeText"),

    currentDate: $("#currentDate"),
    pageTitle: $("#pageTitle"),
    pageSubtitle: $("#pageSubtitle"),
    breadcrumbTitle: $("#breadcrumbTitle"),
    taskSectionTitle: $("#taskSectionTitle"),
    taskSectionSubtitle: $("#taskSectionSubtitle"),

    totalTasks: $("#totalTasks"),
    pendingTasks: $("#pendingTasks"),
    completedTasks: $("#completedTasks"),
    completionRate: $("#completionRate"),
    completionProgress: $("#completionProgress"),
    todayCount: $("#todayCount"),
    allCount: $("#allCount"),

    taskList: $("#taskList"),
    emptyState: $("#emptyState"),
    emptyTitle: $("#emptyTitle"),
    emptyDescription: $("#emptyDescription"),
    taskFooterText: $("#taskFooterText"),

    searchInput: $("#searchInput"),
    sortSelect: $("#sortSelect"),
    clearCompletedButton: $("#clearCompletedButton"),
    addTaskButton: $("#addTaskButton"),
    emptyAddButton: $("#emptyAddButton"),
    todayButton: $("#todayButton"),

    taskDialog: $("#taskDialog"),
    taskForm: $("#taskForm"),
    dialogTitle: $("#dialogTitle"),
    taskId: $("#taskId"),
    taskTitle: $("#taskTitle"),
    taskDescription: $("#taskDescription"),
    taskPriority: $("#taskPriority"),
    taskDueDate: $("#taskDueDate"),
    saveTaskButton: $("#saveTaskButton"),
    closeDialogButton: $("#closeDialogButton"),
    cancelDialogButton: $("#cancelDialogButton"),

    toastContainer: $("#toastContainer"),
    footerYear: $("#footerYear")
};

// Application state
let tasks = loadTasks();
let currentView = "today";
let currentStatus = "all";
let currentPriority = null;
let searchQuery = "";
let toastSequence = 0;

/* =========================================
   DATE HELPERS
========================================= */

function localDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function formatDate(dateString, options = {}) {
    if (!dateString) {
        return "";
    }

    const parts = dateString.split("-").map(Number);

    if (
        parts.length !== 3 ||
        parts.some((part) => !Number.isFinite(part))
    ) {
        return "";
    }

    const [year, month, day] = parts;
    const date = new Date(year, month - 1, day);

    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
    ) {
        return "";
    }

    return new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "short",
        ...options
    }).format(date);
}

function getToday() {
    return localDateString();
}

function getTomorrow() {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return localDateString(date);
}

function isOverdue(task) {
    return Boolean(
        task.dueDate &&
        task.dueDate < getToday() &&
        !task.completed
    );
}

function isToday(task) {
    return task.dueDate === getToday();
}

function isUpcoming(task) {
    return Boolean(
        task.dueDate &&
        task.dueDate > getToday() &&
        !task.completed
    );
}

/* =========================================
   LOCAL STORAGE
========================================= */

function normalizeTask(task) {
    if (!task || typeof task !== "object") {
        return null;
    }

    if (
        typeof task.id !== "string" ||
        typeof task.title !== "string" ||
        !task.title.trim()
    ) {
        return null;
    }

    const allowedPriorities = ["high", "medium", "low"];

    return {
        id: task.id,
        title: task.title.trim().slice(0, 120),
        description:
            typeof task.description === "string"
                ? task.description.slice(0, 500)
                : "",
        priority: allowedPriorities.includes(task.priority)
            ? task.priority
            : "medium",
        dueDate:
            typeof task.dueDate === "string" &&
            /^\d{4}-\d{2}-\d{2}$/.test(task.dueDate) &&
            formatDate(task.dueDate)
                ? task.dueDate
                : "",
        completed: task.completed === true,
        createdAt:
            Number.isFinite(task.createdAt) &&
            task.createdAt > 0
                ? task.createdAt
                : Date.now(),
        updatedAt:
            Number.isFinite(task.updatedAt) &&
            task.updatedAt > 0
                ? task.updatedAt
                : Date.now()
    };
}

function loadTasks() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);

        if (stored === null) {
            return [];
        }

        const parsed = JSON.parse(stored);

        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed
            .map(normalizeTask)
            .filter(Boolean);
    } catch (error) {
        console.error("Could not load saved tasks:", error);
        return [];
    }
}

function saveTasks() {
    try {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(tasks)
        );

        return true;
    } catch (error) {
        console.error("Could not save tasks:", error);

        showToast(
            "Could not save tasks. Check your browser storage.",
            "error"
        );

        return false;
    }
}

function loadTheme() {
    try {
        return localStorage.getItem(THEME_KEY) === "light"
            ? "light"
            : "dark";
    } catch {
        return "dark";
    }
}

/* =========================================
   NOTIFICATIONS
========================================= */

function showToast(message, type = "success") {
    if (!elements.toastContainer) {
        return;
    }

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.setAttribute("role", "status");

    const indicator = document.createElement("span");
    indicator.className = "toast-indicator";
    indicator.textContent = type === "error" ? "!" : "✓";

    const text = document.createElement("span");
    text.textContent = message;

    toast.append(indicator, text);
    elements.toastContainer.appendChild(toast);

    const sequence = ++toastSequence;

    window.setTimeout(() => {
        toast.remove();
    }, 3200);

    return sequence;
}

/* =========================================
   TASK FORM
========================================= */

function openTaskDialog(task = null) {
    elements.taskForm.reset();

    elements.taskId.value = task ? task.id : "";
    elements.taskTitle.value = task ? task.title : "";
    elements.taskDescription.value = task
        ? task.description
        : "";
    elements.taskPriority.value = task
        ? task.priority
        : "medium";
    elements.taskDueDate.value = task
        ? task.dueDate
        : "";

    elements.dialogTitle.textContent = task
        ? "Edit task"
        : "Create a task";

    elements.saveTaskButton.textContent = task
        ? "Save changes"
        : "Create task";

    if (!elements.taskDialog.open) {
        elements.taskDialog.showModal();
    }

    elements.taskTitle.focus();
}

function closeTaskDialog() {
    if (elements.taskDialog.open) {
        elements.taskDialog.close();
    }
}

function createId() {
    if (
        typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function"
    ) {
        return crypto.randomUUID();
    }

    return (
        Date.now().toString(36) +
        Math.random().toString(36).slice(2)
    );
}

function handleTaskSubmit(event) {
    event.preventDefault();

    const title = elements.taskTitle.value.trim();
    const description = elements.taskDescription.value.trim();
    const priority = elements.taskPriority.value;
    const dueDate = elements.taskDueDate.value;
    const existingId = elements.taskId.value;

    if (!title) {
        elements.taskTitle.setCustomValidity(
            "Please enter a task title."
        );
        elements.taskTitle.reportValidity();
        elements.taskTitle.setCustomValidity("");
        return;
    }

    if (title.length > 120 || description.length > 500) {
        showToast("Please shorten your task details.", "error");
        return;
    }

    if (
        priority !== "high" &&
        priority !== "medium" &&
        priority !== "low"
    ) {
        showToast("Please choose a valid priority.", "error");
        return;
    }

    if (dueDate && !formatDate(dueDate)) {
        showToast("Please choose a valid due date.", "error");
        return;
    }

    const now = Date.now();

    if (existingId) {
        const index = tasks.findIndex(
            (task) => task.id === existingId
        );

        if (index === -1) {
            showToast("This task could not be found.", "error");
            closeTaskDialog();
            return;
        }

        const previousTask = tasks[index];

        tasks[index] = {
            ...previousTask,
            title,
            description,
            priority,
            dueDate,
            updatedAt: now
        };

        if (!saveTasks()) {
            tasks[index] = previousTask;
            return;
        }

        closeTaskDialog();
        renderApp();
        showToast("Task updated successfully.");
        return;
    }

    const newTask = {
        id: createId(),
        title,
        description,
        priority,
        dueDate,
        completed: false,
        createdAt: now,
        updatedAt: now
    };

    tasks.unshift(newTask);

    if (!saveTasks()) {
        tasks = tasks.filter((task) => task.id !== newTask.id);
        return;
    }

    closeTaskDialog();
    renderApp();
    showToast("New task created.");
}

/* =========================================
   TASK ACTIONS
========================================= */

function findTask(id) {
    return tasks.find((task) => task.id === id);
}

function toggleTask(id) {
    const task = findTask(id);

    if (!task) {
        return;
    }

    const previousCompleted = task.completed;
    const previousUpdatedAt = task.updatedAt;

    task.completed = !task.completed;
    task.updatedAt = Date.now();

    if (!saveTasks()) {
        task.completed = previousCompleted;
        task.updatedAt = previousUpdatedAt;
        return;
    }

    renderApp();

    showToast(
        task.completed
            ? "Great work! Task completed."
            : "Task moved back to pending."
    );
}

function editTask(id) {
    const task = findTask(id);

    if (!task) {
        showToast("Task not found.", "error");
        return;
    }

    openTaskDialog(task);
}

function deleteTask(id) {
    const task = findTask(id);

    if (!task) {
        return;
    }

    const confirmed = window.confirm(
        `Delete "${task.title}"? This cannot be undone.`
    );

    if (!confirmed) {
        return;
    }

    const previousTasks = tasks;
    tasks = tasks.filter((item) => item.id !== id);

    if (!saveTasks()) {
        tasks = previousTasks;
        return;
    }

    renderApp();
    showToast("Task deleted.");
}

function clearCompletedTasks() {
    const completed = tasks.filter((task) => task.completed);

    if (completed.length === 0) {
        showToast("There are no completed tasks to clear.");
        return;
    }

    const confirmed = window.confirm(
        `Delete all ${completed.length} completed task(s)?`
    );

    if (!confirmed) {
        return;
    }

    const previousTasks = tasks;
    tasks = tasks.filter((task) => !task.completed);

    if (!saveTasks()) {
        tasks = previousTasks;
        return;
    }

    renderApp();
    showToast("Completed tasks cleared.");
}

/* =========================================
   FILTERING AND SORTING
========================================= */

function getVisibleTasks() {
    let visible = [...tasks];

    // Main navigation
    if (currentView === "today") {
        visible = visible.filter(
            (task) => isToday(task) && !task.completed
        );
    } else if (currentView === "upcoming") {
        visible = visible.filter(isUpcoming);
    } else if (currentView === "completed") {
        visible = visible.filter((task) => task.completed);
    }

    // Priority shortcuts
    if (currentPriority) {
        visible = visible.filter(
            (task) => task.priority === currentPriority
        );
    }

    // Status tabs
    if (currentStatus === "pending") {
        visible = visible.filter((task) => !task.completed);
    } else if (currentStatus === "completed") {
        visible = visible.filter((task) => task.completed);
    }

    // Search title and description
    if (searchQuery) {
        const query = searchQuery.toLowerCase();

        visible = visible.filter((task) => {
            return (
                task.title.toLowerCase().includes(query) ||
                task.description.toLowerCase().includes(query)
            );
        });
    }

    // Sorting
    const sort = elements.sortSelect.value;

    if (sort === "created") {
        visible.sort((a, b) => b.createdAt - a.createdAt);
    } else if (sort === "due") {
        visible.sort((a, b) => {
            if (!a.dueDate && !b.dueDate) {
                return b.createdAt - a.createdAt;
            }

            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;

            return a.dueDate.localeCompare(b.dueDate);
        });
    } else if (sort === "priority") {
        const rank = {
            high: 0,
            medium: 1,
            low: 2
        };

        visible.sort((a, b) => {
            return rank[a.priority] - rank[b.priority];
        });
    } else if (sort === "alphabetical") {
        visible.sort((a, b) =>
            a.title.localeCompare(b.title)
        );
    }

    return visible;
}

/* =========================================
   TASK CARD CREATION
========================================= */

function createElement(tag, className, text = "") {
    const element = document.createElement(tag);

    if (className) {
        element.className = className;
    }

    if (text !== "") {
        element.textContent = text;
    }

    return element;
}

function createTaskCard(task) {
    const item = createElement(
        "article",
        `task-item${task.completed ? " is-completed" : ""}`
    );

    const checkbox = createElement(
        "button",
        `task-checkbox${task.completed ? " checked" : ""}`,
        task.completed ? "✓" : ""
    );

    checkbox.type = "button";
    checkbox.setAttribute(
        "aria-label",
        task.completed
            ? `Mark ${task.title} as pending`
            : `Mark ${task.title} as completed`
    );
    checkbox.setAttribute(
        "aria-pressed",
        String(task.completed)
    );
    checkbox.addEventListener("click", () => toggleTask(task.id));

    const content = createElement("div", "task-content");

    const title = createElement("h3", "task-title", task.title);
    content.appendChild(title);

    if (task.description) {
        content.appendChild(
            createElement(
                "p",
                "task-description",
                task.description
            )
        );
    }

    const meta = createElement("div", "task-meta");

    const priority = createElement(
        "span",
        `priority-badge priority-${task.priority}`,
        task.priority.charAt(0).toUpperCase() +
            task.priority.slice(1)
    );

    meta.appendChild(priority);

    if (task.dueDate) {
        let dueText = `Due ${formatDate(task.dueDate, {
            year: "numeric"
        })}`;

        if (isToday(task)) {
            dueText = "Due today";
        } else if (task.dueDate === getTomorrow()) {
            dueText = "Due tomorrow";
        }

        const dueBadge = createElement(
            "span",
            `due-badge${isOverdue(task) ? " overdue" : ""}`,
            isOverdue(task)
                ? `Overdue · ${formatDate(task.dueDate, {
                    year: "numeric"
                })}`
                : dueText
        );

        meta.appendChild(dueBadge);
    }

    if (task.completed) {
        meta.appendChild(
            createElement("span", "due-badge", "Completed")
        );
    }

    content.appendChild(meta);

    const actions = createElement("div", "task-actions");

    const editButton = createElement(
        "button",
        "task-action-button",
        "✎"
    );

    editButton.type = "button";
    editButton.title = "Edit task";
    editButton.setAttribute(
        "aria-label",
        `Edit ${task.title}`
    );
    editButton.addEventListener("click", () => editTask(task.id));

    const deleteButton = createElement(
        "button",
        "task-action-button delete-action",
        "×"
    );

    deleteButton.type = "button";
    deleteButton.title = "Delete task";
    deleteButton.setAttribute(
        "aria-label",
        `Delete ${task.title}`
    );
    deleteButton.addEventListener(
        "click",
        () => deleteTask(task.id)
    );

    actions.append(editButton, deleteButton);
    item.append(checkbox, content, actions);

    return item;
}

function renderTaskList() {
    const visibleTasks = getVisibleTasks();

    elements.taskList.replaceChildren();

    const fragment = document.createDocumentFragment();

    visibleTasks.forEach((task) => {
        fragment.appendChild(createTaskCard(task));
    });

    elements.taskList.appendChild(fragment);

    const isEmpty = visibleTasks.length === 0;
    elements.emptyState.hidden = !isEmpty;
    elements.taskList.hidden = isEmpty;

    if (isEmpty) {
        if (searchQuery) {
            elements.emptyTitle.textContent = "No matching tasks.";
            elements.emptyDescription.textContent =
                "Try another search term or change your filters.";
        } else if (currentView === "today") {
            elements.emptyTitle.textContent =
                "Your day is a blank canvas.";
            elements.emptyDescription.textContent =
                "Add a task due today, or create one without a due date in All Tasks.";
        } else if (currentView === "upcoming") {
            elements.emptyTitle.textContent =
                "Nothing coming up yet.";
            elements.emptyDescription.textContent =
                "Tasks with future due dates will appear here.";
        } else if (currentView === "completed") {
            elements.emptyTitle.textContent =
                "Every achievement starts somewhere.";
            elements.emptyDescription.textContent =
                "Complete a task and it will appear here.";
        } else {
            elements.emptyTitle.textContent =
                "Nothing to show just yet.";
            elements.emptyDescription.textContent =
                "Add a task or adjust your filters to get started.";
        }
    }

    elements.taskFooterText.textContent =
        `${visibleTasks.length} task${visibleTasks.length === 1 ? "" : "s"} shown`;
}

/* =========================================
   DASHBOARD STATISTICS
========================================= */

function renderStatistics() {
    const total = tasks.length;
    const completed = tasks.filter(
        (task) => task.completed
    ).length;
    const pending = total - completed;

    const todayTasks = tasks.filter(
        (task) => isToday(task) && !task.completed
    ).length;

    const rate = total === 0
        ? 0
        : Math.round((completed / total) * 100);

    elements.totalTasks.textContent = total;
    elements.pendingTasks.textContent = pending;
    elements.completedTasks.textContent = completed;
    elements.completionRate.textContent = `${rate}%`;

    elements.completionProgress.style.width = `${rate}%`;
    elements.completionProgress.setAttribute(
        "aria-valuenow",
        String(rate)
    );

    elements.todayCount.textContent = todayTasks;
    elements.allCount.textContent = total;

    elements.clearCompletedButton.disabled = completed === 0;
}

/* =========================================
   NAVIGATION AND PAGE HEADINGS
========================================= */

const viewDetails = {
    today: {
        title: "My Day",
        subtitle: "A fresh start. Let's make it productive.",
        section: "Today's tasks",
        sectionSubtitle: "Keep your momentum going."
    },
    upcoming: {
        title: "Upcoming",
        subtitle: "See what's on the horizon.",
        section: "Coming up",
        sectionSubtitle: "Your future tasks, all in one place."
    },
    all: {
        title: "All Tasks",
        subtitle: "Everything you're working on.",
        section: "Your workspace",
        sectionSubtitle: "All your tasks, organized."
    },
    completed: {
        title: "Completed",
        subtitle: "Look at how far you've come.",
        section: "Finished tasks",
        sectionSubtitle: "Every completed task is progress."
    }
};

function setView(view) {
    if (!Object.hasOwn(viewDetails, view)) {
        return;
    }

    currentView = view;
    currentPriority = null;
    currentStatus = view === "completed"
        ? "completed"
        : "all";

    updateNavigation();
    renderApp();
}

function setPriority(priority) {
    const allowed = ["high", "medium", "low"];

    if (!allowed.includes(priority)) {
        return;
    }

    currentPriority = currentPriority === priority
        ? null
        : priority;

    currentView = "all";
    currentStatus = "all";

    updateNavigation();
    renderApp();
}

function updateNavigation() {
    const details = viewDetails[currentView];

    elements.pageTitle.replaceChildren(
        document.createTextNode(details.title),
        createElement("span", "heading-period", ".")
    );

    elements.breadcrumbTitle.textContent = details.title;
    elements.pageSubtitle.textContent = details.subtitle;
    elements.taskSectionTitle.textContent = currentPriority
        ? `${currentPriority.charAt(0).toUpperCase()}${currentPriority.slice(1)} priority`
        : details.section;
    elements.taskSectionSubtitle.textContent = currentPriority
        ? "Tasks matching your selected priority."
        : details.sectionSubtitle;

    $$("[data-view]").forEach((button) => {
        button.classList.toggle(
            "active",
            button.dataset.view === currentView
        );
    });

    $$("[data-priority]").forEach((button) => {
        button.classList.toggle(
            "active",
            button.dataset.priority === currentPriority
        );
    });

    $$(".filter-tab").forEach((button) => {
        button.classList.toggle(
            "active",
            button.dataset.status === currentStatus
        );
    });
}

/* =========================================
   THEME
========================================= */

function applyTheme(theme) {
    const isLight = theme === "light";

    document.body.classList.toggle("light-theme", isLight);

    elements.themeIcon.textContent = isLight ? "☾" : "☼";
    elements.themeText.textContent = isLight
        ? "Switch to dark mode"
        : "Switch to light mode";

    elements.themeToggle.setAttribute(
        "aria-label",
        isLight
            ? "Switch to dark mode"
            : "Switch to light mode"
    );
}

function toggleTheme() {
    const nextTheme = document.body.classList.contains("light-theme")
        ? "dark"
        : "light";

    try {
        localStorage.setItem(THEME_KEY, nextTheme);
    } catch (error) {
        console.error("Could not save theme preference:", error);
    }

    applyTheme(nextTheme);
}

/* =========================================
   MAIN RENDER
========================================= */

function renderApp() {
    renderStatistics();
    updateNavigation();
    renderTaskList();
}

/* =========================================
   EVENT LISTENERS
========================================= */

// Open the create-task dialog
elements.addTaskButton.addEventListener("click", () => {
    openTaskDialog();
});

elements.emptyAddButton.addEventListener("click", () => {
    openTaskDialog();
});

// Save a new task or edit an existing one
elements.taskForm.addEventListener(
    "submit",
    handleTaskSubmit
);

// Close or cancel the dialog
elements.closeDialogButton.addEventListener(
    "click",
    closeTaskDialog
);

elements.cancelDialogButton.addEventListener(
    "click",
    closeTaskDialog
);

// Close the dialog by clicking outside the form
elements.taskDialog.addEventListener("click", (event) => {
    if (event.target === elements.taskDialog) {
        closeTaskDialog();
    }
});

// Clear completed tasks
elements.clearCompletedButton.addEventListener(
    "click",
    clearCompletedTasks
);

// Main navigation
$$("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
        setView(button.dataset.view);

        if (window.innerWidth <= 900) {
            closeSidebar();
        }
    });
});

// Priority navigation
$$("[data-priority]").forEach((button) => {
    button.addEventListener("click", () => {
        setPriority(button.dataset.priority);

        if (window.innerWidth <= 900) {
            closeSidebar();
        }
    });
});

// Status filters
$$(".filter-tab").forEach((button) => {
    button.addEventListener("click", () => {
        currentStatus = button.dataset.status;
        updateNavigation();
        renderTaskList();
    });
});

// Search tasks as the user types
elements.searchInput.addEventListener("input", () => {
    searchQuery = elements.searchInput.value.trim();
    renderTaskList();
});

// Sorting
elements.sortSelect.addEventListener("change", () => {
    renderTaskList();
});

// Theme toggle
elements.themeToggle.addEventListener(
    "click",
    toggleTheme
);

// Return to today's tasks
elements.todayButton.addEventListener("click", () => {
    setView("today");
});

// Mobile sidebar
function openSidebar() {
    elements.sidebar.classList.add("open");
    elements.menuToggle.setAttribute("aria-expanded", "true");
}

function closeSidebar() {
    elements.sidebar.classList.remove("open");
    elements.menuToggle.setAttribute("aria-expanded", "false");
}

elements.menuToggle.addEventListener("click", () => {
    const isOpen = elements.sidebar.classList.contains("open");

    if (isOpen) {
        closeSidebar();
    } else {
        openSidebar();
    }
});

// Close mobile sidebar when clicking outside it
document.addEventListener("click", (event) => {
    if (window.innerWidth > 900) {
        return;
    }

    const clickedSidebar = elements.sidebar.contains(event.target);
    const clickedMenu = elements.menuToggle.contains(event.target);

    if (!clickedSidebar && !clickedMenu) {
        closeSidebar();
    }
});

// Keyboard shortcut: Ctrl+K or Cmd+K focuses search
document.addEventListener("keydown", (event) => {
    const isSearchShortcut =
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "k";

    if (isSearchShortcut) {
        event.preventDefault();
        elements.searchInput.focus();
    }

    if (event.key === "Escape") {
        closeSidebar();
    }
});

/* =========================================
   INITIALIZE APP
========================================= */

function initializeApp() {
    elements.currentDate.textContent =
        new Intl.DateTimeFormat("en-IN", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
        }).format(new Date()).toUpperCase();

    elements.footerYear.textContent = new Date().getFullYear();

    applyTheme(loadTheme());
    updateNavigation();
    renderApp();

    console.log("Dayflow initialized successfully.");
}

initializeApp();