/**
 * ============================================================
 * Todo Application — Frontend JavaScript
 * ============================================================
 *
 * WHAT THIS FILE DOES
 * -------------------
 * This file is the "brain" of the frontend. It talks to our
 * Flask backend over HTTP, then updates the page to show the
 * latest data — all without ever reloading the browser tab.
 *
 * The pattern used here is sometimes called a "Single-Page
 * Application" (SPA) even though it is very lightweight:
 *
 *   User action  →  API call  →  Update state  →  Re-render DOM
 *
 * TECHNOLOGIES USED
 * -----------------
 * • fetch API   — the browser's built-in tool for making HTTP
 *                 requests (replaces older XMLHttpRequest).
 * • async/await — syntax sugar over Promises that lets us write
 *                 asynchronous code that reads like regular,
 *                 top-to-bottom synchronous code.
 * • Vanilla JS  — no frameworks (React, Vue, etc.). Everything
 *                 is plain browser JavaScript.
 *
 * WHY 'use strict'?
 * -----------------
 * Enables strict mode. JavaScript has several "gotchas" — for
 * example, accidentally creating a global variable by
 * misspelling a name. Strict mode turns those silent bugs into
 * loud errors so they're easier to find and fix.
 */
'use strict';


// ============================================================
// SECTION 1 — CONFIGURATION
// ============================================================
//
// A single constant that holds the backend API's base URL.
// Defining it here (rather than repeating the string
// everywhere) means you only need to change it in one place
// if the server address changes — e.g., when deploying to
// production.

const API_URL = 'http://localhost:5001/api/todos';


// ============================================================
// SECTION 2 — APPLICATION STATE
// ============================================================
//
// "State" is a snapshot of everything the app currently knows.
// Instead of reading the DOM every time we need data (slow and
// error-prone), we keep a single JavaScript object as the
// source of truth and derive the DOM from it.
//
// Think of it like a variable that stores:
//   • todos   — the current list of todo items from the server
//   • loading — whether an API call is in-flight right now
//   • error   — any error message to display to the user
//
// Whenever state changes, we call render() to sync the page.

/** @type {{ todos: Array, loading: boolean, error: string|null }} */
const state = {
  todos: [],      // Starts empty; populated by fetchTodos()
  loading: false, // True while waiting for a server response
  error: null,    // Null means "no error"
};


// ============================================================
// SECTION 3 — DOM REFERENCES
// ============================================================
//
// The DOM (Document Object Model) is the browser's live
// representation of the HTML. To update it from JavaScript we
// need references to specific elements.
//
// We collect them all in one place (the `dom` object) instead
// of calling getElementById() repeatedly throughout the code.
// This is faster and easier to debug.
//
// IMPORTANT: We cannot call getElementById() at the top of
// the file because the HTML has not been fully parsed yet when
// scripts run. resolveDOM() is called after the browser fires
// the DOMContentLoaded event (see Section 4).

let dom = {}; // Will be populated by resolveDOM() below

/**
 * Looks up every HTML element we need and stores references
 * in the `dom` object. Called once when the page is ready.
 */
function resolveDOM() {
  dom = {
    form:         document.getElementById('todo-form'),
    titleInput:   document.getElementById('todo-title'),
    titleError:   document.getElementById('title-error'),
    descInput:    document.getElementById('todo-description'),
    submitBtn:    document.getElementById('submit-btn'),
    todoCount:    document.getElementById('todo-count'),
    loading:      document.getElementById('loading'),
    emptyState:   document.getElementById('empty-state'),
    errorState:   document.getElementById('error-state'),
    errorMessage: document.getElementById('error-message'),
    todosList:    document.getElementById('todos-list'),
    toast:        document.getElementById('toast'),
  };
}


// ============================================================
// SECTION 4 — BOOTSTRAP (app startup)
// ============================================================
//
// 'DOMContentLoaded' fires when the browser has finished
// parsing the HTML and building the DOM tree — but BEFORE
// images and stylesheets finish loading. That makes it the
// ideal moment to attach event listeners and kick off the
// first API call.
//
// The flow on every page load is:
//   1. resolveDOM()  — grab all element references
//   2. bindEvents()  — attach click/submit listeners
//   3. fetchTodos()  — load the initial list from the server

document.addEventListener('DOMContentLoaded', () => {
  resolveDOM();
  bindEvents();
  fetchTodos();
});

/**
 * Attaches all user-interaction event listeners.
 *
 * Keeping listener registration here (separate from the
 * handlers themselves) makes it easy to see at a glance
 * what events the app responds to.
 */
function bindEvents() {
  // Listen for the form's "submit" event, which fires when the
  // user clicks the Add button OR presses Enter in the input.
  dom.form.addEventListener('submit', handleFormSubmit);

  // As the user types in the title field, clear any previous
  // validation error. This gives immediate, friendly feedback
  // rather than waiting for them to submit again.
  dom.titleInput.addEventListener('input', () => {
    dom.titleInput.classList.remove('invalid');
    dom.titleError.textContent = '';
  });
}


// ============================================================
// SECTION 5 — API HELPER
// ============================================================
//
// WHY WRAP fetch()?
// -----------------
// The browser's built-in fetch() is powerful but verbose.
// Every call needs the same Content-Type header, and
// error-handling requires checking response.ok separately
// from catching network errors.
//
// Our `request()` wrapper solves this by:
//   1. Always attaching the JSON content-type header.
//   2. Always parsing the JSON body if the server sent one.
//   3. Returning a plain object { ok, status, data } so
//      callers get everything they need in one go.
//
// WHY async/await?
// ----------------
// Network requests take time — the browser cannot simply
// pause and wait; it would freeze the whole page. JavaScript
// handles this with "Promises" — objects that represent a
// value that will arrive in the future.
//
// async/await is a cleaner way to work with Promises:
//
//   PROMISE STYLE (harder to read):
//     fetch(url)
//       .then(res => res.json())
//       .then(data => console.log(data))
//       .catch(err => console.error(err));
//
//   async/await STYLE (reads top-to-bottom like sync code):
//     const res  = await fetch(url);
//     const data = await res.json();
//     console.log(data);
//
// The `await` keyword pauses execution of THIS function until
// the Promise resolves, but the rest of the browser (other
// events, animations) keeps running normally.

/**
 * A thin wrapper around the browser's fetch() API.
 *
 * Always resolves (never throws) to an object with:
 *   ok     {boolean} — true if HTTP status was 2xx
 *   status {number}  — the raw HTTP status code (200, 404, …)
 *   data   {*}       — parsed JSON body, or null
 *
 * @param {string}      url     — the endpoint to call
 * @param {RequestInit} options — optional fetch options (method, body, …)
 */
async function request(url, options = {}) {
  // fetch() returns a Promise. `await` unwraps it, giving us
  // the Response object once the server replies.
  const response = await fetch(url, {
    // Merge the default Content-Type header with any caller-
    // supplied options. The spread operator (...options) lets
    // the caller override anything except the header default.
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  // Only parse the body as JSON if the server actually sent
  // JSON back. The ?. is "optional chaining" — safely returns
  // undefined instead of throwing if the header is absent.
  const data = response.headers.get('Content-Type')?.includes('application/json')
    ? await response.json()
    : null;

  // response.ok is true for status codes 200–299.
  // We return it alongside the data so callers can check
  // success without dealing with the raw Response object.
  return { ok: response.ok, status: response.status, data };
}


// ============================================================
// SECTION 6 — FETCH TODOS (Read all)
// ============================================================
//
// This is the first API call made when the page loads.
// It follows a "loading → success/error" pattern that is
// standard in modern web apps:
//
//   1. Set loading = true  → show spinner
//   2. Await the API call
//   3a. On success: store todos, set loading = false
//   3b. On failure: store error message, set loading = false
//   4. Call render() to reflect the new state
//
// ABOUT try / catch / finally
// ----------------------------
// When code inside a `try` block throws an error — or when
// `await` rejects — execution jumps to the `catch` block.
// This prevents the app from crashing and lets us show a
// friendly error message instead.
//   try    — code that might fail
//   catch  — what to do when it fails
//   finally — runs regardless (used to reset loading state)

/**
 * Loads all todos from the server and re-renders the list.
 *
 * Called automatically on page load and can be called again
 * to manually refresh the data.
 */
async function fetchTodos() {
  // Update state first, then re-render to show the spinner.
  setState({ loading: true, error: null });
  render();

  try {
    // GET http://localhost:5001/api/todos
    // No method/body needed — GET is the default.
    const { ok, data } = await request(API_URL);

    // Even if fetch() succeeded (no network error), the
    // server might have returned a 4xx/5xx error. We check
    // response.ok and throw a descriptive error so the catch
    // block handles both failure modes the same way.
    if (!ok) throw new Error(data?.error ?? 'Failed to load todos');

    setState({ todos: data, loading: false });
  } catch (err) {
    // err.message is either the server's error text or a
    // browser network error (e.g., "Failed to fetch" when
    // the server is offline).
    setState({ loading: false, error: err.message });
  }

  // Render runs after both success and failure branches
  // because state has changed in both cases.
  render();
}


// ============================================================
// SECTION 7 — CREATE TODO (Handle form submit)
// ============================================================
//
// HOW FORM SUBMISSION WORKS
// -------------------------
// Normally a browser form submission causes a full-page
// reload. We prevent that with event.preventDefault() and
// handle everything ourselves via fetch().
//
// The flow:
//   1. Prevent default browser behaviour
//   2. Validate the input on the client (fast, no round-trip)
//   3. POST the data to the API as JSON
//   4. On success: add the new todo to local state, clear form
//   5. On failure: show an error toast

/**
 * Handles the "Add Todo" form submission.
 *
 * @param {SubmitEvent} event — the browser's submit event
 */
async function handleFormSubmit(event) {
  // Stop the browser from navigating away or reloading the page.
  event.preventDefault();

  // .trim() removes leading/trailing whitespace so "   "
  // doesn't pass as a valid title.
  const title       = dom.titleInput.value.trim();
  const description = dom.descInput.value.trim();

  // ── Client-side validation ─────────────────────────────
  // We check for an empty title BEFORE sending to the server.
  // This gives instant feedback (no waiting for a round-trip)
  // and matches the server's own validation as a safety net.
  if (!title) {
    dom.titleInput.classList.add('invalid'); // Red border via CSS
    dom.titleInput.focus();                  // Return keyboard focus
    dom.titleError.textContent = 'Title is required.';
    return; // Stop here — do NOT call the API
  }

  // Disable the submit button and change its label while the
  // request is in-flight to prevent double-submitting.
  setSubmitting(true);

  try {
    // POST http://localhost:5001/api/todos
    // JSON.stringify() converts the JS object to a JSON string
    // that the server can parse. e.g.: '{"title":"Buy milk"}'
    const { ok, data } = await request(API_URL, {
      method: 'POST',
      body: JSON.stringify({ title, description }),
    });

    if (!ok) throw new Error(data?.error ?? 'Could not create todo');

    // Optimistic UI update: add the returned todo object to
    // the FRONT of our local array (newest first), then
    // re-render — no need for another GET request.
    //
    // The spread operator [...state.todos] creates a new
    // array rather than mutating the existing one.
    setState({ todos: [data, ...state.todos] });
    clearForm();     // Reset the input fields
    renderList();    // Refresh the visible list
    updateCount();   // Update the "N todos" badge
    showToast('Todo added ✓', 'success');
  } catch (err) {
    // Show the error in the toast notification rather than
    // crashing the page or silently swallowing the error.
    showToast(err.message, 'error');
  } finally {
    // `finally` runs whether the try succeeded or the catch
    // fired. Always re-enable the button.
    setSubmitting(false);
  }
}


// ============================================================
// SECTION 8 — TOGGLE COMPLETE (Update)
// ============================================================
//
// Flips a todo between completed and not-completed.
//
// We send a PUT request with only the `completed` field —
// this is a "partial update" (the server accepts any subset
// of fields). We do NOT resend title/description because we
// only want to change completion status.

/**
 * Toggles the completed status of a todo.
 *
 * @param {number}  id               — the todo's primary key
 * @param {boolean} currentCompleted — its current status
 */
async function toggleTodo(id, currentCompleted) {
  // Build the payload with the INVERTED value.
  // If it was true, we send false, and vice versa.
  const payload = { completed: !currentCompleted };

  try {
    // PUT http://localhost:5001/api/todos/1  (for id = 1)
    // Template literals (`...`) let us embed the id directly
    // in the URL string.
    const { ok, data } = await request(`${API_URL}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });

    if (!ok) throw new Error(data?.error ?? 'Could not update todo');

    // Replace just the one changed todo in our state array.
    // Array.map() returns a NEW array — if the id matches,
    // we use the server's response (the updated todo); for
    // all other items we keep the original.
    setState({
      todos: state.todos.map(t => (t.id === id ? data : t)),
    });
    renderList();
    updateCount();
    showToast(data.completed ? 'Marked complete ✓' : 'Marked incomplete', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}


// ============================================================
// SECTION 9 — DELETE TODO
// ============================================================
//
// Removes a todo from the server and from the local state.
//
// UI enhancement: we animate the list item sliding out BEFORE
// re-rendering, so the removal feels smooth rather than abrupt.

/**
 * Permanently deletes a todo.
 *
 * @param {number} id — the todo's primary key
 */
async function deleteTodo(id) {
  try {
    // DELETE http://localhost:5001/api/todos/1  (for id = 1)
    // The server returns { message: "Todo deleted successfully" }
    // on success.
    const { ok, data } = await request(`${API_URL}/${id}`, {
      method: 'DELETE',
    });

    if (!ok) throw new Error(data?.error ?? 'Could not delete todo');

    // Remove the deleted item from local state immediately.
    // Array.filter() creates a new array containing only
    // todos whose id does NOT match — effectively deleting it.
    setState({ todos: state.todos.filter(t => t.id !== id) });

    // Find the HTML element for this todo item.
    const item = document.getElementById(`todo-${id}`);
    if (item) {
      // Apply a CSS transition: fade out + slide right over 200 ms.
      item.style.transition = 'opacity 200ms ease, transform 200ms ease';
      item.style.opacity    = '0';
      item.style.transform  = 'translateX(20px)';

      // Wait 220 ms (slightly longer than the animation) then
      // re-render the list. This replaces the now-invisible
      // element with the freshly rendered list (which won't
      // include the deleted item at all).
      setTimeout(() => { renderList(); updateCount(); }, 220);
    } else {
      // If the element somehow wasn't found, update immediately.
      renderList();
      updateCount();
    }

    showToast('Todo deleted', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}


// ============================================================
// SECTION 10 — RENDERING
// ============================================================
//
// These functions read from `state` and update the DOM to
// match. They are called after any state change.
//
// DESIGN PRINCIPLE — "derived UI":
// The DOM is never the source of truth; `state` is. We never
// read values back out of the DOM to make decisions. This
// avoids an entire class of bugs where the page shows stale
// or inconsistent data.

/**
 * Top-level render function.
 *
 * Decides which "view" to show (loading spinner, error
 * message, or the todo list) based on the current state.
 * Then delegates list-specific rendering to renderList().
 */
function render() {
  // ── Loading state ──────────────────────────────────────
  // Show the spinner and hide everything else while we wait
  // for the server to respond.
  if (state.loading) {
    show(dom.loading);
    hide(dom.emptyState);
    hide(dom.errorState);
    dom.todosList.innerHTML = ''; // Clear any previous list
    return; // Exit early — nothing else to render yet
  }

  hide(dom.loading); // Request is done; hide spinner

  // ── Error state ────────────────────────────────────────
  // If the API call failed, show the error panel with the
  // error message. The user can click "Retry" to reload.
  if (state.error) {
    show(dom.errorState);
    hide(dom.emptyState);
    dom.errorMessage.textContent = state.error;
    dom.todosList.innerHTML = '';
    return; // Exit early — no list to show
  }

  // ── Success state ──────────────────────────────────────
  // Data is available and no error — render the list.
  hide(dom.errorState);
  renderList();
  updateCount();
}

/**
 * Renders the list of todo items (or the empty state if the
 * list has no items).
 *
 * Called by render() and also directly by the CRUD functions
 * after create/toggle/delete to avoid a full re-render.
 */
function renderList() {
  const { todos } = state;

  // Show the "No todos yet" message when the list is empty.
  if (todos.length === 0) {
    show(dom.emptyState);
    dom.todosList.innerHTML = '';
    return;
  }

  hide(dom.emptyState);

  // Array.map() transforms each todo object into an HTML
  // string. Array.join('') merges them all into one string.
  // Setting innerHTML replaces the entire list at once —
  // faster than creating elements one by one.
  dom.todosList.innerHTML = todos.map(buildTodoHTML).join('');

  // Attach button listeners AFTER the new HTML is in the DOM.
  attachTodoListeners();
}

/**
 * Updates the "N todos" count badge in the section header.
 * Uses the plural "todos" for any count other than 1.
 */
function updateCount() {
  const n = state.todos.length;
  dom.todoCount.textContent = `${n} todo${n !== 1 ? 's' : ''}`;
}


// ============================================================
// SECTION 11 — HTML BUILDER
// ============================================================
//
// Builds the HTML markup for a single todo item as a string.
//
// SECURITY — WHY WE USE esc()
// ----------------------------
// If a todo title contained HTML like <script>alert('xss')</script>
// and we injected it directly into innerHTML, the browser
// would execute it — a Cross-Site Scripting (XSS) attack.
// esc() converts those characters to safe HTML entities
// (&lt; &gt; etc.) so they display as text, never as code.
//
// DATA ATTRIBUTES
// ---------------
// Each button stores its associated todo id and state in
// data-* attributes (data-id, data-action, data-completed).
// These are readable from JavaScript via element.dataset.*
// and let a single delegated listener handle all clicks.

/**
 * Builds the HTML string for a single todo list item.
 *
 * @param {{ id: number, title: string, description: string,
 *            completed: boolean, created_at: string }} todo
 * @returns {string} — a <li>…</li> HTML fragment
 */
function buildTodoHTML(todo) {
  // Add the CSS "completed" class if the todo is done.
  // The CSS rule then applies strikethrough and reduced opacity.
  const completedClass = todo.completed ? ' completed' : '';

  // Format the ISO timestamp ("2024-01-15T10:30:00") into a
  // readable string ("Jan 15, 2024, 10:30 AM").
  const date = formatDate(todo.created_at);

  // Only render the description paragraph if one exists.
  // An empty description would leave an ugly blank gap.
  const desc = todo.description
    ? `<p class="todo-description">${esc(todo.description)}</p>`
    : '';

  // Toggle button changes label based on current state.
  const completeBtnLabel = todo.completed ? 'Undo' : 'Complete';
  const completeBtnIcon  = todo.completed ? '↩️'  : '✅';

  // Template literal (backtick string) lets us write
  // multi-line HTML and embed JavaScript expressions with ${}.
  return `
    <li class="todo-item${completedClass}" id="todo-${todo.id}">
      <div class="todo-body">
        <p class="todo-title">${esc(todo.title)}</p>
        ${desc}
      </div>
      <div class="todo-footer">
        <time class="todo-date" datetime="${esc(todo.created_at)}">
          📅 ${date}
        </time>
        <div class="todo-actions">
          <button
            class="btn btn-success"
            data-action="toggle"
            data-id="${todo.id}"
            data-completed="${todo.completed}"
            aria-label="${completeBtnLabel}: ${esc(todo.title)}"
          >
            <span aria-hidden="true">${completeBtnIcon}</span>
            ${completeBtnLabel}
          </button>
          <button
            class="btn btn-danger"
            data-action="delete"
            data-id="${todo.id}"
            aria-label="Delete: ${esc(todo.title)}"
          >
            <span aria-hidden="true">🗑️</span>
            Delete
          </button>
        </div>
      </div>
    </li>
  `.trim();
}

/**
 * Attaches a single click listener to the todo list using
 * "event delegation".
 *
 * EVENT DELEGATION EXPLAINED
 * --------------------------
 * Instead of adding a separate listener to every button
 * (potentially hundreds), we add ONE listener to the parent
 * <ul> element. Clicks on child buttons "bubble up" to it.
 *
 * We then use event.target.closest('[data-action]') to find
 * the nearest ancestor with a data-action attribute. This
 * correctly handles clicks on the emoji <span> inside the
 * button — closest() walks up the DOM tree until it finds
 * the button itself.
 *
 * Benefits:
 * • Works even after innerHTML is replaced (re-rendering)
 * • Only one listener to clean up — no memory leaks
 * • O(1) regardless of list size
 */
function attachTodoListeners() {
  dom.todosList.onclick = (event) => {
    // Find the clicked button (or a button ancestor of what
    // was clicked). Returns null if no match found.
    const btn = event.target.closest('[data-action]');
    if (!btn) return; // Click was not on a button — ignore it

    // Read the todo id and action from data attributes.
    // Number() converts the string "1" to the number 1.
    const id        = Number(btn.dataset.id);
    const action    = btn.dataset.action;
    const completed = btn.dataset.completed === 'true'; // "true" → true

    if (action === 'toggle') toggleTodo(id, completed);
    if (action === 'delete') deleteTodo(id);
  };
}


// ============================================================
// SECTION 12 — UI HELPERS
// ============================================================
//
// Small, reusable utilities that keep the main functions
// focused and free of repetitive boilerplate.

/**
 * Merges a partial update into the global state object.
 *
 * Object.assign() copies all properties from `patch` onto
 * `state`, overwriting any with the same key.
 *
 * Example: setState({ loading: false }) only updates the
 * `loading` key; todos and error are left unchanged.
 *
 * @param {Partial<typeof state>} patch
 */
function setState(patch) {
  Object.assign(state, patch);
}

/**
 * Shows an element by removing the `hidden` attribute.
 * Using `hidden` (a boolean HTML attribute) is more
 * semantically correct and accessible than toggling
 * `display: none` via CSS classes.
 */
function show(el) { el.hidden = false; }

/**
 * Hides an element by setting the `hidden` attribute.
 */
function hide(el) { el.hidden = true; }

/**
 * Resets the Add Todo form to its empty initial state.
 * Called after a successful create so the user can
 * immediately type the next todo.
 */
function clearForm() {
  dom.titleInput.value = '';
  dom.descInput.value  = '';
  dom.titleInput.classList.remove('invalid'); // Remove red border
  dom.titleError.textContent = '';            // Clear error text
}

/**
 * Toggles the submit button's disabled state and label
 * while an API call is in progress.
 *
 * Disabling the button prevents "double-submit" — where a
 * user clicks Add multiple times and creates duplicate todos.
 *
 * @param {boolean} isSubmitting
 */
function setSubmitting(isSubmitting) {
  dom.submitBtn.disabled = isSubmitting;
  // Restore the full button HTML (with icon) when done.
  // We rebuild it as innerHTML because we need the emoji span.
  if (!isSubmitting) {
    dom.submitBtn.innerHTML =
      '<span class="btn-icon" aria-hidden="true">➕</span> Add Todo';
  } else {
    dom.submitBtn.textContent = 'Adding…';
  }
}


// ============================================================
// SECTION 13 — TOAST NOTIFICATIONS
// ============================================================
//
// A "toast" is a small non-blocking message that appears
// briefly to confirm an action or report an error, then
// disappears automatically.
//
// HOW THE ANIMATION WORKS
// -----------------------
// The CSS starts the toast off-screen (translateY(120%)) and
// invisible (opacity: 0). Adding the "show" class transitions
// it to its visible position. Removing "show" reverses the
// animation.
//
// "void t.offsetWidth" forces the browser to recalculate
// layout (a "reflow"). Without it, if we update className
// and add "show" in the same task, the browser may batch
// both DOM changes together and skip the transition entirely.

/** Timer ID for auto-dismissal — stored so we can cancel it. */
let toastTimer = null;

/**
 * Shows a brief status notification that auto-dismisses.
 *
 * @param {string}                  message — text to display
 * @param {'success'|'error'|''}    type    — visual style
 */
function showToast(message, type = '') {
  const t = dom.toast;

  // Cancel any in-progress dismiss timer so rapid calls
  // don't hide a newly shown toast immediately.
  clearTimeout(toastTimer);

  t.textContent = message;
  // Reset the className each call to clear previous type
  // modifiers (e.g., 'error') before setting the new one.
  t.className   = `toast${type ? ' ' + type : ''}`;

  // Force a reflow so the CSS transition fires correctly
  // even if the toast is currently in the middle of hiding.
  void t.offsetWidth;
  t.classList.add('show'); // Trigger slide-in animation

  // After 2.8 seconds, slide the toast back out of view.
  toastTimer = setTimeout(() => {
    t.classList.remove('show');
  }, 2800);
}


// ============================================================
// SECTION 14 — UTILITY FUNCTIONS
// ============================================================

/**
 * Escapes HTML special characters in a string to prevent
 * Cross-Site Scripting (XSS) attacks.
 *
 * XSS EXPLAINED
 * -------------
 * If a user saved a todo with the title:
 *   <img src=x onerror="steal(document.cookie)">
 * …and we inserted that raw string into innerHTML, the
 * browser would treat it as real HTML and execute the script.
 *
 * esc() converts the dangerous characters to their "entity"
 * equivalents so they display as literal text:
 *   < → &lt;    > → &gt;    & → &amp;
 *   " → &quot;  ' → &#39;
 *
 * @param {string} text — the raw user-provided string
 * @returns {string}    — the safely escaped version
 */
function esc(text) {
  return String(text ?? '') // ?? '' handles null/undefined
    .replace(/&/g, '&amp;')  // & MUST be first to avoid double-escaping
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Converts an ISO 8601 timestamp string from the server
 * into a locale-appropriate, human-readable date and time.
 *
 * The server stores and returns dates in UTC ISO 8601 format:
 *   "2024-01-15T10:30:00.000000"
 *
 * new Date() parses this and toLocaleString() formats it
 * using the user's own time zone and language preferences.
 * For example, a UK user would see "15 Jan 2024, 10:30".
 *
 * @param {string} isoString — ISO date from the API
 * @returns {string}         — formatted date string, or "—" if empty
 */
function formatDate(isoString) {
  if (!isoString) return '—';
  try {
    return new Date(isoString).toLocaleString(undefined, {
      year:   'numeric',
      month:  'short',
      day:    'numeric',
      hour:   '2-digit',
      minute: '2-digit',
    });
  } catch {
    // If parsing fails for any reason, fall back to the raw
    // string rather than crashing.
    return isoString;
  }
}


// ============================================================
// SECTION 15 — TEST EXPORTS
// ============================================================
//
// In a browser, `module` is undefined and this block is
// skipped. In a Node.js test environment (Jest, for example),
// `module` exists and we export the pure utility functions
// so they can be unit-tested without a live browser.

if (typeof module !== 'undefined') {
  module.exports = { esc, formatDate, buildTodoHTML, state };
}

// Made with Bob
