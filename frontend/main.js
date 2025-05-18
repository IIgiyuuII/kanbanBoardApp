const API_BASE = "http://localhost:8000/api";
const OAUTH_TOKEN_URL = "http://localhost:8000/o/token/";

(async function handleInviteInUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  const inviteParam = urlParams.get("invite");

  if (inviteParam) {
    localStorage.setItem("pending_invite", inviteParam);

    //сразу очищаем адресную строку
    const cleanUrl = new URL(window.location);
    cleanUrl.searchParams.delete("invite");
    window.history.replaceState({}, document.title, cleanUrl.pathname);

    // Проверка токена
    const token = localStorage.getItem("access_token");
    if (token) {
      try {
        axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

        const boardsRes = await axios.get(`${API_BASE}/boards/`);
        const boards = boardsRes.data;

        const matchedBoard = boards.find(board => board.invite_token === inviteParam);

        if (matchedBoard) {
          localStorage.removeItem("pending_invite");
          openBoard(matchedBoard.id);
        }
      } catch (err) {
        console.warn("Ошибка при открытии доски по invite-ссылке", err);
        // не открываем доску, если что-то пошло не так
      }
    }
  }
})();

async function handleRegister() {
  const fields = ["username", "email", "password", "password2"];

  // Сброс ошибок и красных рамок
  fields.forEach(field => {
    const input = document.getElementById("reg-" + field);
    const errorElem = document.getElementById("error-" + field);
    if (input) input.classList.remove("input-error");
    if (errorElem) errorElem.innerText = "";
  });

  const username = document.getElementById("reg-username")?.value.trim() || "";
  const email = document.getElementById("reg-email")?.value.trim() || "";
  const password = document.getElementById("reg-password")?.value || "";
  const password2 = document.getElementById("reg-password2")?.value || "";

  try {
    await axios.post(`${API_BASE}/register/`, {
      username,
      email,
      password,
      password2
    });

    alert("Регистрация прошла успешно!");
    renderAuthScreen();

  } catch (err) {
    const errors = err.response?.data || {};

    for (const field in errors) {
      const messageRaw = Array.isArray(errors[field]) ? errors[field][0] : errors[field];
      const message = translateError(messageRaw);
      const input = document.getElementById("reg-" + field);
      const errorElem = document.getElementById("error-" + field);
      if (errorElem) errorElem.innerText = message;
      if (input) input.classList.add("input-error");
    }
  }
}

// 🔄 Переводит стандартные DRF-ошибки на русский
function translateError(message) {
  if (message === "This field may not be blank.") return "Заполните поле";
  if (message === "Enter a valid email address.") return "Введите корректный email";
  if (message === "This field is required.") return "Это поле обязательно";
  return message;
}


async function registerUser() {
  if (isLoginScreen) {
    console.warn("Нельзя вызвать регистрацию с экрана входа");
    return;
  }
  
  const usernameInput = document.getElementById("reg-username");
  const emailInput = document.getElementById("reg-email");
  const passwordInput = document.getElementById("reg-password");
  const password2Input = document.getElementById("reg-password2");

  // ❗ если хотя бы одно поле не найдено — прекращаем
  if (!usernameInput || !emailInput || !passwordInput || !password2Input) {
    console.error("Форма регистрации не найдена в DOM");
    return;
  }

  // очищаем ошибки
  ["username", "email", "password", "password2"].forEach(field => {
    document.getElementById(`error-${field}`).innerText = "";
    document.getElementById(`reg-${field}`).classList.remove("input-error");
  });

  const username = usernameInput.value.trim();
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const password2 = password2Input.value;

  // frontend валидация
  let hasError = false;
  if (!username) {
    showError("username", "Заполните имя пользователя");
    hasError = true;
  }
  if (!email) {
    showError("email", "Введите email");
    hasError = true;
  }
  if (!password) {
    showError("password", "Введите пароль");
    hasError = true;
  }
  if (!password2) {
    showError("password2", "Повторите пароль");
    hasError = true;
  }
  if (hasError) return;

  try {
    await axios.post(`${API_BASE}/register/`, {
      username,
      email,
      password,
      password2
    });
    alert("Успешная регистрация!");
    renderAuthScreen();
  } catch (err) {
    const errors = err.response?.data;
    for (let key in errors) {
      showError(key, errors[key][0]);
    }
  }
}

function showError(field, message) {
  const errorDiv = document.getElementById(`error-${field}`);
  const input = document.getElementById(`reg-${field}`);
  if (errorDiv) errorDiv.innerText = message;
  if (input) input.classList.add("input-error");
}



let boards = [];
let currentBoardId = null;
let currentColumnId = null;
let currentBoardForColumnEdit = null;
let currentBoard = null;
let currentBoardRole = null;
// Ставим токен в axios
function setAuthToken(token) {
  localStorage.setItem("access_token", token);
  axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
}

// Проверка токена
function checkAuth() {
  const token = localStorage.getItem("access_token");

  // Очистим сломанный invite если пользователь уже авторизован
  if (token && localStorage.getItem("pending_invite")) {
    localStorage.removeItem("pending_invite");
  }

  if (token) {
    setAuthToken(token);
    renderMainScreen();
  } else {
    renderAuthScreen();
  }
}
let isLoginScreen = true;
// Форма логина и регистрации
function renderAuthScreen() {
  isLoginScreen = true;
  document.getElementById("app").innerHTML = `
    <div class="auth-container">
      <h2>Вход</h2>
      <input type="text" id="login-username" placeholder="Имя пользователя">
      <input type="password" id="login-password" placeholder="Пароль">
      <button onclick="loginUser()">Войти</button>
      <p class="auth-toggle">
        Нет аккаунта? <span onclick="renderRegisterScreen()" style="color: blue; cursor: pointer;">Зарегистрируйтесь!</span>
      </p>
    </div>
  `;
}

function renderRegisterScreen() {
  isLoginScreen = false;
  document.getElementById("app").innerHTML = `
    <div class="auth-container">
      <h2>Регистрация</h2>

      <div class="input-group">
        <div id="error-username" class="error-message"></div>
        <input type="text" id="reg-username" placeholder="Имя пользователя" />
      </div>

      <div class="input-group">
        <div id="error-email" class="error-message"></div>
        <input type="email" id="reg-email" placeholder="Email" />
      </div>

      <div class="input-group">
        <div id="error-password" class="error-message"></div>
        <input type="password" id="reg-password" placeholder="Пароль" />
      </div>

      <div class="input-group">
        <div id="error-password2" class="error-message"></div>
        <input type="password" id="reg-password2" placeholder="Повторите пароль" />
      </div>

      <button onclick="handleRegister()">Зарегистрироваться</button>

      <p class="auth-toggle">
        Уже есть аккаунт? <span onclick="renderAuthScreen()" style="color: blue; cursor: pointer;">Войти</span>
      </p>
    </div>


  `;
}



// Логин через OAuth2
async function loginUser() {
  const username = document.getElementById("login-username").value;
  const password = document.getElementById("login-password").value;

  const usernameDisplay = document.getElementById("user-name");
  const avatarDisplay = document.getElementById("user-avatar");

  try {
    const response = await axios.post("http://localhost:8000/o/token/", new URLSearchParams({
      grant_type: "password",
      username: username,
      password: password,
      client_id: "qggLwqnypyizoBYWHzWgcAfPs0hvP3UGrmLO0Bp5", // client_id
      client_secret: "SoXbtfxeEKWDeF4aXxiBaEA6TCd5twGDIWftPQNyx4s5p9ApVKo9DnZXcAvFT6uOko0JSNQnwOhb1FhtCpevi6f0SLOUM4xfPUET2esTZnj7dgP5M2HHqEHJS4xxgNDV" // client_secret
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const token = response.data.access_token;
    localStorage.setItem("access_token", token);
    axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

    localStorage.setItem("username", username);
    if (usernameDisplay && avatarDisplay) {
      usernameDisplay.innerText = username;
      avatarDisplay.innerText = username.charAt(0).toUpperCase();
    }

  


    const pendingInvite = localStorage.getItem("pending_invite");

    if (pendingInvite) {
      try {
        // Пробуем присоединиться
        await axios.get(`${API_BASE}/join/${pendingInvite}/`);
        localStorage.removeItem("pending_invite");
    
        // Получаем список досок
        const boardsRes = await axios.get(`${API_BASE}/boards/`);
        const boards = boardsRes.data;
    
        // Ищем доску
        const joinedBoard = boards.find(board => board.invite_token === pendingInvite);
    
        // 💡 Удаляем invite-параметр из URL
        const url = new URL(window.location);
        if (url.searchParams.has('invite')) {
          url.searchParams.delete('invite');
          window.history.replaceState({}, document.title, url.pathname);
        }
    
        if (joinedBoard) {
          openBoard(joinedBoard.id);
        } else {
          renderMainScreen();
        }
    
      } catch (joinError) {
        console.error("Ошибка при присоединении к доске:", joinError);
        localStorage.removeItem("pending_invite");
    
        // 💡 Всё равно удаляем invite-параметр
        const url = new URL(window.location);
        if (url.searchParams.has('invite')) {
          url.searchParams.delete('invite');
          window.history.replaceState({}, document.title, url.pathname);
        }
    
        renderMainScreen();
      }
    
    } else {
      // 💡 Даже если invite был только в адресной строке (без localStorage)
      const url = new URL(window.location);
      if (url.searchParams.has('invite')) {
        url.searchParams.delete('invite');
        window.history.replaceState({}, document.title, url.pathname);
      }
    
      renderMainScreen();
    }

  } catch (error) {
    console.error(error);
    alert("Ошибка входа. Проверьте имя пользователя и пароль.");
  }
}


// Регистрация нового пользователя
async function registerUser() {
  const username = document.getElementById("register-username").value;
  const password = document.getElementById("register-password").value;

  try {
    await axios.post(`${API_BASE}/register/`, { username, password });
    alert("Регистрация успешна. Теперь войдите.");
    renderAuthScreen();
  } catch (error) {
    console.error(error);
    alert("Ошибка регистрации.");
  }
}

// Логаут
function logout() {
  localStorage.removeItem("access_token");
  delete axios.defaults.headers.common["Authorization"];
  renderAuthScreen();
}


// Функция отрисовки главного экрана досок
function renderMainScreen() {
  const username = localStorage.getItem("username") || "Гость";
  document.getElementById("app").innerHTML = `
    <header class="main-header">
      <div class="header-left">
        <img src="/static/images/home.svg" alt="Домой" class="home-icon" onclick="goBack()" />
        <div class="projects-title">Мои проекты</div>
      </div>
      <div class="header-right user-info">
        <span class="user-name" id="user-name">${username}</span>
        <div class="user-avatar-text" id="user-avatar">${username.charAt(0).toUpperCase()}</div>
        <button onclick="logout()" class="logout-btn">Выйти</button>
      </div>
    </header>
    <main>
      <div id="board-grid" class="board-grid"></div>
    </main>
  `;

  fetchBoards(); 
}


// Получение досок
async function fetchBoards() {
  try {
    const token = localStorage.getItem("access_token");
    axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

    const response = await axios.get(`${API_BASE}/boards/`);
    boards = response.data;

    const boardGrid = document.getElementById("board-grid");
    boardGrid.innerHTML = "";

    const createCard = document.createElement("div");
    createCard.className = "board-card create-board";
    createCard.innerHTML = `
      <div class="create-board-content">
        <div class="create-board-title">Новая доска</div>
        <div class="create-board-plus">+</div>
      </div>
    `;
    createCard.addEventListener("click", async () => {
      const token = localStorage.getItem("access_token");
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

      await axios.post(`${API_BASE}/boards/`, { title: "Новая доска" });
      fetchBoards();
    });
    boardGrid.appendChild(createCard);

    boards.forEach(board => {
      const card = document.createElement("div");
      card.className = "board-card";
      card.innerHTML = `
        <div class="board-title-center" title="${board.title}">${board.title}</div>
        
        <div class="menu-dots" onclick="event.stopPropagation(); toggleMenu(this)">
          &#8942;
          <div class="dropdown hidden">
            <div onclick="editBoard(${board.id}, '${board.title.replace(/'/g, "\\'")}')">Редактировать</div>
            <div onclick="deleteBoard(${board.id}, '${board.title.replace(/'/g, "\\'")}')">Удалить</div>
          </div>
        </div>
      `;
      card.addEventListener("click", () => openBoard(board.id));
      boardGrid.appendChild(card);
    });
    
  } catch (error) {
    if (error.response && error.response.status === 403) {
      logout();
    } else {
      console.error(error);
    }
  }
}


window.openBoard = async (id) => {

  const token = localStorage.getItem("access_token");
  axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

  currentBoardId = id;

// Добавляем веб сокет
  if (window.boardSocket && window.boardSocket.readyState !== WebSocket.CLOSED) {
  window.boardSocket.close();
}
  
  window.boardSocket = new WebSocket(`ws://localhost:8000/ws/board/${currentBoardId}/`);

window.boardSocket.onmessage = function (event) {
  const data = JSON.parse(event.data);
  if (data.message === "reload") {
    openBoard(currentBoardId);
  }
};

  const res = await axios.get(`${API_BASE}/boards/${id}/`);
  await axios.post(`${API_BASE}/boards/${id}/mark_opened/`);
  const board = res.data;
  currentBoardRole = board.role;
  currentBoard = board;
  localStorage.setItem("last_opened_board", id);


  document.getElementById("app").innerHTML = `
  <header class="main-header">
    <div class="header-left">
      <img src="/static/images/home.svg" alt="Домой" class="home-icon" onclick="goBack()" />
      <h1 class="board-title-header" title="${board.title}">${board.title}</h1>
      <button class="responsive-btn" onclick="openInviteMenu()">
        📨 <span class="btn-text">Пригласить</span>
      </button>
      <button class="responsive-btn" onclick="openMembersModal()">
        👥 <span class="btn-text">Участники</span>
      </button>
    </div>
    <div class="header-right">
      <span class="user-name" id="user-name">${localStorage.getItem("username") || "Пользователь"}</span>
      <div class="user-avatar-text" id="user-avatar">${(localStorage.getItem("username") || "U").charAt(0).toUpperCase()}</div>
      <button class="logout-btn" onclick="logout()">Выйти</button>
    </div>
  </header>
  <main class="columns-container" id="columns-container"></main>
`;


const container = document.getElementById("columns-container");
container.innerHTML = "";

  board.columns.forEach(column => {
    const col = document.createElement("div");
    col.className = "column";
    col.dataset.columnId = column.id;

    
    
    
    col.innerHTML = `
<div class="column-header">
    <h3>${column.title}</h3>
    <div class="column-controls">
      <div class="sort-wrapper">
        <img src="/static/images/sort-icon.svg" alt="Сортировка" class="sort-icon" onclick="toggleSortDropdown(event, ${column.id})" />
        <div class="sort-dropdown hidden" id="sort-dropdown-${column.id}">
          <div onclick="sortTasks(${column.id}, 'priority-asc')">↑ По приоритету</div>
          <div onclick="sortTasks(${column.id}, 'priority-desc')">↓ По приоритету</div>
          <div onclick="sortTasks(${column.id}, 'date-asc')">↑ По дате</div>
          <div onclick="sortTasks(${column.id}, 'date-desc')">↓ По дате</div>
          <div onclick="sortTasks(${column.id}, 'comments-asc')">↑ По комментариям</div>
          <div onclick="sortTasks(${column.id}, 'comments-desc')">↓ По комментариям</div>
        </div>
      </div>
      <div class="menu-dots" onclick="event.stopPropagation(); toggleMenu(this)">
        &#8942;
        <div class="dropdown hidden">
          <div onclick="editColumn(${column.id}, '${column.title.replace(/'/g, "\\'")}', ${board.id})">Редактировать</div>
          <div onclick="deleteColumn(${column.id}, ${board.id})">Удалить</div>
        </div>
      </div>
    </div>
  </div>

`;
 // 📦 Контейнер задач
 const tasksWrapper = document.createElement("div");
 tasksWrapper.className = "tasks-wrapper";
 tasksWrapper.dataset.columnId = column.id;
 col.appendChild(tasksWrapper);

  // 📝 Задачи внутри колонки
  column.tasks?.forEach(task => {
    const taskCard = document.createElement("div");
    taskCard.className = "task-card";
    taskCard.dataset.taskId = task.id;

    taskCard.dataset.priority = task.priority;
    taskCard.dataset.date = task.due_date || "";
    taskCard.dataset.comments = task.comments_count || 0;

    const rawDate = task.due_date ? new Date(task.due_date) : null;
    const formattedDate = rawDate
      ? rawDate.toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" })
      : "не указана";

    let priorityColor = "#ffcc00";
    if (task.priority === "low") priorityColor = "#4CAF50";
    if (task.priority === "high") priorityColor = "#f44336";

    taskCard.innerHTML = `
  <div class="priority-strip" style="background-color: ${priorityColor};"></div>
  <div class="task-title centered-title">${task.title}</div>
  <div class="task-details centered-details">
    <span class="task-date">${formattedDate}</span>
    <div class="comment-icon">
      <img src="/static/images/comment-icon.svg" alt="Комментарии" />
      <span>${task.comments_count || 0}</span>
    </div>
  </div>
`;
    taskCard.onclick = () => openTaskEditor(task.id, column.id);
    tasksWrapper.appendChild(taskCard);
  });
  

  // ➕ Кнопка добавления карточки
  const addCardBtn = document.createElement("div");
  addCardBtn.className = "add-card-btn";
  addCardBtn.innerText = "+ Add a card";
  addCardBtn.onclick = () => createTask(column.id);
  col.appendChild(addCardBtn);

  container.appendChild(col);
});
// 📦 DnD для задач с помощью Sortable.js
document.querySelectorAll(".tasks-wrapper").forEach(wrapper => {
  new Sortable(wrapper, {
    group: "tasks",
    animation: 150,
    onEnd: async (evt) => {
      const newColumnId = parseInt(evt.to.dataset.columnId);
      
      // ⛔ Отменяем, если не в колонке
      if (!newColumnId) return;

      // 🧠 Всегда пересчитываем все задачи по DOM-порядку
      const taskCards = Array.from(evt.to.querySelectorAll(".task-card"));

      const updates = taskCards.map((card, index) => {
        const taskId = parseInt(card.dataset.taskId);
        return {
          id: taskId,
          column: newColumnId
        };
      });

      const token = localStorage.getItem("access_token");
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

      for (let task of updates) {
        await axios.patch(`${API_BASE}/tasks/${task.id}/`, {
          column: task.column,
        });

        if (window.boardSocket && window.boardSocket.readyState === WebSocket.OPEN) {
          window.boardSocket.send(JSON.stringify({ message: "reload" }));
        }
        
      }

      openBoard(currentBoardId); // перерисовка
    }
  });
});





  const addColumn = document.createElement("div");
  addColumn.className = "add-column-card";
  addColumn.innerHTML = "+";
  addColumn.onclick = () => {
    const title = prompt("Название новой колонки:");
    if (title) {
      axios.post(`${API_BASE}/columns/`, { board: board.id, title }).then(() => {

        if (window.boardSocket && window.boardSocket.readyState === WebSocket.OPEN) {
          window.boardSocket.send(JSON.stringify({ message: "reload" }));
        }

        openBoard(board.id)
      });
    }
  };
  container.appendChild(addColumn);
  new Sortable(container, {
    animation: 150,
    handle: '.column-header',
    ghostClass: 'sortable-ghost',
    onEnd: async () => {
      const columnElements = Array.from(document.querySelectorAll(".column"));
      const token = localStorage.getItem("access_token");
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  
      for (let i = 0; i < columnElements.length; i++) {
        const columnId = columnElements[i].dataset.columnId;
        await axios.patch(`${API_BASE}/columns/${columnId}/`, {
          order: i
        });

        if (window.boardSocket && window.boardSocket.readyState === WebSocket.OPEN) {
          window.boardSocket.send(JSON.stringify({ message: "reload" }));
        }
        
      }
  
      openBoard(currentBoardId); // перерисовка
    }
  });
  
  
};
async function createTask(columnId) {
  const token = localStorage.getItem("access_token");
  axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

  await axios.post(`${API_BASE}/tasks/`, {
    title: "новая задача",
    column: columnId,
  });

  if (window.boardSocket && window.boardSocket.readyState === WebSocket.OPEN) {
    window.boardSocket.send(JSON.stringify({ message: "reload" }));
  }

  openBoard(currentBoardId);
}

function createModals() {
  const modalBoard = document.createElement("div");
  modalBoard.id = "edit-modal";
  modalBoard.className = "modal hidden";
  modalBoard.innerHTML = `
    <div class="modal-content">
      <h3>Изменить название доски</h3>
      <input type="text" id="edit-board-title" placeholder="Новое название">
      <button id="save-edit">Сохранить</button>
      <button id="cancel-edit">Отмена</button>
    </div>
  `;
  document.body.appendChild(modalBoard);

  const inputBoard = modalBoard.querySelector("#edit-board-title");
  modalBoard.querySelector("#save-edit").onclick = async () => {
    const newTitle = inputBoard.value.trim();
    if (newTitle && currentBoardId) {

      const token = localStorage.getItem("access_token");
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

      await axios.patch(`${API_BASE}/boards/${currentBoardId}/`, { title: newTitle });
      modalBoard.classList.add("hidden");
      currentBoardId = null;
      renderMainScreen();
    }
  };
  modalBoard.querySelector("#cancel-edit").onclick = () => {
    modalBoard.classList.add("hidden");
    currentBoardId = null;
  };

  const modalColumn = document.createElement("div");
  modalColumn.id = "edit-column-modal";
  modalColumn.className = "modal hidden";
  modalColumn.innerHTML = `
    <div class="modal-content">
      <h3>Изменить название колонки</h3>
      <input type="text" id="edit-column-title" placeholder="Новое название">
      <button id="save-edit-column">Сохранить</button>
      <button id="cancel-edit-column">Отмена</button>
    </div>
  `;
  document.body.appendChild(modalColumn);

  const inputColumn = modalColumn.querySelector("#edit-column-title");
modalColumn.querySelector("#save-edit-column").onclick = async () => {
  const newTitle = inputColumn.value.trim();
  if (newTitle && currentColumnId) {

    const token = localStorage.getItem("access_token");
    axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

    await axios.patch(`${API_BASE}/columns/${currentColumnId}/`, { title: newTitle });

    // 🔁 Обновляем DOM — только текст заголовка, не перерисовываем всю доску
    const column = document.querySelector(`.column[data-column-id="${currentColumnId}"]`);
    if (column) {
      const titleEl = column.querySelector("h3");
      if (titleEl) titleEl.innerText = newTitle;
    }

    // 🧩 Отправляем WebSocket-сообщение другим пользователям
    if (window.boardSocket && window.boardSocket.readyState === WebSocket.OPEN) {
      window.boardSocket.send(JSON.stringify({ message: "reload" }));
    }

    // Закрываем модалку
    modalColumn.classList.add("hidden");
    currentColumnId = null;
  }
};

  modalColumn.querySelector("#cancel-edit-column").onclick = () => {
    modalColumn.classList.add("hidden");
    currentColumnId = null;
  };
}
const deleteModal = document.createElement("div");
deleteModal.id = "delete-board-modal";
deleteModal.className = "modal hidden";
deleteModal.innerHTML = `
  <div class="modal-content">
    <h3 id="delete-board-message">Вы уверены, что хотите удалить доску?</h3>
    <div class="buttons">
      <button id="confirm-delete-board">Удалить</button>
      <button id="cancel-delete-board">Отмена</button>
    </div>
  </div>
`;
document.body.appendChild(deleteModal);

window.editBoard = (id, title) => {

  const token = localStorage.getItem("access_token");
  axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

  currentBoardId = id;
  const modal = document.getElementById("edit-modal");
  modal.querySelector("#edit-board-title").value = title;
  modal.classList.remove("hidden");
};

window.editColumn = (columnId, currentTitle, boardId) => {
  const modal = document.getElementById("edit-column-modal");

  // 🆕 Вместо currentTitle из аргумента — читаем из DOM
  const columnElement = document.querySelector(`.column[data-column-id="${columnId}"]`);
  const actualTitle = columnElement?.querySelector("h3")?.innerText || currentTitle;

  modal.querySelector("#edit-column-title").value = actualTitle;

  currentColumnId = columnId;
  currentBoardForColumnEdit = boardId;

  modal.classList.remove("hidden");
};


window.deleteBoard = (id, title) => {
  const modal = document.getElementById("delete-board-modal");
  const message = document.getElementById("delete-board-message");
  message.textContent = `Вы уверены, что хотите удалить доску "${title}"?`;
  modal.classList.remove("hidden");

  // Назначим обработчики подтверждения и отмены
  document.getElementById("confirm-delete-board").onclick = async () => {
    const token = localStorage.getItem("access_token");
    axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

    await axios.delete(`${API_BASE}/boards/${id}/`);
    modal.classList.add("hidden");
    renderMainScreen();
  };

  document.getElementById("cancel-delete-board").onclick = () => {
    modal.classList.add("hidden");
  };
};

window.openInviteMenu = async () => {
  const boardId = currentBoardId;
  const token = localStorage.getItem("access_token");
  axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

  try {
    const res = await axios.get(`${API_BASE}/invite-link/${boardId}/`);
    const link = res.data.invite_url;

    const modal = document.createElement("div");
    modal.className = "modal";
    modal.innerHTML = `
      <div class="modal-content">
        <h3>Ссылка для приглашения</h3>
        <input type="text" value="${link}" readonly />
        <button onclick="navigator.clipboard.writeText('${link}')">Скопировать</button>
        <button onclick="this.closest('.modal').remove()">Закрыть</button>
      </div>
    `;
    document.body.appendChild(modal);
  } catch (error) {
    console.error("Ошибка получения ссылки приглашения:", error);
    alert("Не удалось получить ссылку приглашения");
  }
};

window.openMembersModal = async () => {
  try {
    const res = await axios.get(`${API_BASE}/boards/${currentBoardId}/`);
    const board = res.data;
    const isAdmin = board.role === "admin";
    const currentUserId = board.current_user_id;

    // Формируем список участников
    const memberList = board.members.map(user => {
      const isMember = user.role === "member";
      const isSelf = user.id === currentUserId;
      const youLabel = isSelf ? "<strong>(Вы)</strong> " : "";
      return `
        <li class="member-item" data-user-id="${user.id}" data-role="${user.role}">
          ${youLabel}${user.username} (${user.role})
          ${
            isAdmin && !isSelf && isMember ? `
              <div class="member-actions" style="display:none;">
                <button class="rounded-btn promote-btn">Сделать редактором</button>
                <button class="rounded-btn delete-btn">Удалить</button>
              </div>` : ""
          }
        </li>
      `;
    }).join("");

    // Создаём модальное окно
    const modal = document.createElement("div");
    modal.className = "modal members-modal";
    modal.innerHTML = `
      <div class="modal-content members-content">
        <h3 class="modal-title">Участники</h3>
        <ul class="members-list">${memberList}</ul>
        <button class="rounded-btn close-btn">Закрыть</button>
      </div>
    `;
    modal.querySelector(".close-btn").onclick = () => modal.remove();
    document.body.appendChild(modal);

    // Навешиваем логику на участников
    modal.querySelectorAll(".member-item").forEach(item => {
      const userId = parseInt(item.dataset.userId);
      const role = item.dataset.role;
      const isSelf = userId === currentUserId;

      if (isSelf) return; // ⛔ себя не трогаем

      if (role === "member") {
        item.onclick = () => {
          const menu = item.querySelector(".member-actions");
          if (menu) {
            menu.style.display = menu.style.display === "none" ? "block" : "none";
          }
        };

        const promoteBtn = item.querySelector(".promote-btn");
        const deleteBtn = item.querySelector(".delete-btn");

        if (promoteBtn) {
          promoteBtn.onclick = async (e) => {
            e.stopPropagation();
            await axios.post(`${API_BASE}/boards/${currentBoardId}/set_admin/`, {
              user_id: userId
            });
            modal.remove();
            openMembersModal();
          };
        }

        if (deleteBtn) {
          deleteBtn.onclick = async (e) => {
            e.stopPropagation();
            const confirmed = confirm("Вы уверены, что хотите удалить пользователя из доски?");
            if (!confirmed) return;
            await axios.post(`${API_BASE}/boards/${currentBoardId}/remove_user/`, {
              user_id: userId
            });
            modal.remove();
            openMembersModal();
          };
        }
      }

      if (role === "admin" && isAdmin) {
        item.onclick = () => {
          const menu = document.createElement("div");
          menu.className = "member-actions";
          menu.innerHTML = `
            <button class="rounded-btn downgrade-btn">Сделать участником</button>
            <button class="rounded-btn delete-btn">Удалить</button>
          `;
          document.querySelectorAll(".member-actions").forEach(m => m.remove());
          item.appendChild(menu);

          // Понизить
          menu.querySelector(".downgrade-btn").onclick = async (e) => {
            e.stopPropagation();
            await axios.post(`${API_BASE}/boards/${currentBoardId}/set_member/`, {
              user_id: userId
            });
            modal.remove();
            openMembersModal();
          };

          // Удалить
          menu.querySelector(".delete-btn").onclick = async (e) => {
            e.stopPropagation();
            const confirmed = confirm("Удалить этого администратора?");
            if (!confirmed) return;
            await axios.post(`${API_BASE}/boards/${currentBoardId}/remove_user/`, {
              user_id: userId
            });
            modal.remove();
            openMembersModal();
          };
        };
      }
    });
  } catch (error) {
    console.error("Ошибка загрузки участников:", error);
  }
};



window.deleteColumn = async (columnId, boardId) => {

  const token = localStorage.getItem("access_token");
  axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

  await axios.delete(`${API_BASE}/columns/${columnId}/`);

  if (window.boardSocket && window.boardSocket.readyState === WebSocket.OPEN) {
    window.boardSocket.send(JSON.stringify({ message: "reload" }));
  }
  
  openBoard(boardId);
};

window.toggleMenu = (el) => {
  const menu = el.querySelector(".dropdown");
  document.querySelectorAll(".dropdown").forEach(d => {
    if (d !== menu) d.classList.add("hidden");
  });
  menu.classList.toggle("hidden");
};

window.goBack = () => {
  localStorage.removeItem("last_opened_board");
  renderMainScreen();
};

async function submitComment(taskId) {
  const textArea = document.getElementById("new-comment-text");
  const text = textArea.value.trim();

  if (!text) return;

  const token = localStorage.getItem("access_token");
  axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

  try {
    const res = await axios.post(`${API_BASE}/comments/`, {
      task: taskId,
      text: text,
    });

    if (window.boardSocket && window.boardSocket.readyState === WebSocket.OPEN) {
      window.boardSocket.send(JSON.stringify({ message: "reload" }));
    }
    

    const comment = res.data;

    // 🔽 Добавляем комментарий прямо в DOM, без перезагрузки
    const commentsContainer = document.getElementById("comments-container");
    // Удаляем сообщение "Комментариев пока нет..."
    const emptyMessage = commentsContainer.querySelector("p");
    if (emptyMessage?.textContent === "Комментариев пока нет...") {
      emptyMessage.remove();
    }

    const commentDiv = document.createElement("div");
    commentDiv.className = "comment";
    commentDiv.innerHTML = `
      <strong>${comment.author_name}</strong>
      <p>${comment.text}</p>
    `;
    commentsContainer.appendChild(commentDiv);

    // Очищаем поле ввода
    textArea.value = "";
    scrollCommentsToBottom();

    // 🔁 Обновляем счётчик в заголовке
    const title = document.querySelector(".comment-section h3");
    const currentCount = commentsContainer.querySelectorAll(".comment").length;
    title.textContent = `Комментарии (${currentCount})`;
  } catch (error) {
    console.error("Ошибка при добавлении комментария:", error);
  }
  // Обновляем счётчик комментариев на карточке задачи
const taskCard = document.querySelector(`.task-card[data-task-id="${taskId}"]`);
if (taskCard) {
  const counterSpan = taskCard.querySelector(".comment-icon span");
  if (counterSpan) {
    const currentCount = parseInt(counterSpan.textContent) || 0;
    counterSpan.textContent = currentCount + 1;
  }
}

}
window.toggleSortDropdown = (event, columnId) => {
  event.stopPropagation();
  const dropdown = document.getElementById(`sort-dropdown-${columnId}`);
  document.querySelectorAll(".sort-dropdown").forEach(d => {
    if (d !== dropdown) d.classList.add("hidden");
  });
  dropdown.classList.toggle("hidden");
};

function sortTasks(columnId, criteria) {
  const wrapper = document.querySelector(`.tasks-wrapper[data-column-id="${columnId}"]`);
  const tasks = Array.from(wrapper.querySelectorAll(".task-card"));

  const priorityMap = { low: 1, medium: 2, high: 3 };

  tasks.sort((a, b) => {
    if (criteria === "priority-asc" || criteria === "priority-desc") {
      const aPriority = priorityMap[a.dataset.priority];
      const bPriority = priorityMap[b.dataset.priority];
      return criteria === "priority-asc" ? aPriority - bPriority : bPriority - aPriority;

    } else if (criteria === "date-asc" || criteria === "date-desc") {
      const aDate = a.dataset.date || "";
      const bDate = b.dataset.date || "";
      if (!aDate && !bDate) return 0;
      if (!aDate) return 1;
      if (!bDate) return -1;
      return criteria === "date-asc" 
        ? new Date(aDate) - new Date(bDate)
        : new Date(bDate) - new Date(aDate);

    } else if (criteria === "comments-asc" || criteria === "comments-desc") {
      const aComments = parseInt(a.dataset.comments) || 0;
      const bComments = parseInt(b.dataset.comments) || 0;
      return criteria === "comments-asc" ? aComments - bComments : bComments - aComments;
    }

    return 0;
  });

  // Перерисовка отсортированных задач
  wrapper.innerHTML = "";
  tasks.forEach(task => wrapper.appendChild(task));

  // Закрытие выпадающего меню после сортировки
  document.getElementById(`sort-dropdown-${columnId}`).classList.add("hidden");
}







function scrollCommentsToBottom() {
  const container = document.getElementById("comments-container");
  if (container) {
    container.scrollTop = container.scrollHeight;
  }
}


// Открытие модального окна с редактированием карточки
window.openTaskEditor = async (taskId, columnId) => {
  // Удаляем предыдущее окно
  const existingModal = document.getElementById("task-edit-modal");
  if (existingModal) existingModal.remove();

  // Получаем задачу
  const token = localStorage.getItem("access_token");
  axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  const res = await axios.get(`${API_BASE}/tasks/${taskId}/`);
  const task = res.data;

   // Загружаем комментарии
   const commentsRes = await axios.get(`${API_BASE}/comments/?task=${taskId}`);
   const comments = commentsRes.data;
   const role = currentBoardRole;
  // Создаём модальное окно
  const modal = document.createElement("div");
  modal.className = "modal";
  modal.id = "task-edit-modal";
  modal.innerHTML = `
    <div class="modal-content modern-task-modal two-column-modal">
  <div class="task-editor-left">
    <span class="close-modal" onclick="document.getElementById('task-edit-modal').remove()">×</span>

    <div class="task-section">
      <label for="task-title-${taskId}">Название</label>
      <textarea id="task-title-${taskId}" class="auto-resize-title">${task.title}</textarea>
    </div>

    <div class="task-section">
      <label for="task-due-${taskId}">Дата окончания</label>
      <input type="date" id="task-due-${taskId}" value="${task.due_date ? new Date(task.due_date).toISOString().substr(0, 10) : ''}" />
    </div>

    <div class="task-section">
      <label>Приоритет</label>
      <div class="priority-options">
        <span class="priority-dot green ${task.priority === 'low' ? 'selected' : ''}" data-value="low"></span>
        <span class="priority-dot yellow ${task.priority === 'medium' ? 'selected' : ''}" data-value="medium"></span>
        <span class="priority-dot red ${task.priority === 'high' ? 'selected' : ''}" data-value="high"></span>
      </div>
    </div>

    <div class="task-section">
      <label for="task-desc-${taskId}">Описание</label>
      <textarea id="task-desc-${taskId}" placeholder="Leave the comment">${task.description || ''}</textarea>
    </div>

    <div class="task-footer">
      <button id="save-task-${taskId}" class="save-task-btn">Сохранить</button>
      <button id="delete-task-${taskId}" class="delete-task-btn">Удалить</button>
    </div>
  </div>

  <div class="comment-section">
    <h3>Комментарии (<span id="comment-count">${comments?.length || 0}</span>)</h3>
    <div id="comments-container"></div>
      <div class="comment-input-wrapper">
      <textarea id="new-comment-text" placeholder="Напишите комментарий..."></textarea>
      <button onclick="submitComment(${taskId})">Отправить</button>
      </div>
    </div>
</div>

  `;
  document.body.appendChild(modal);


  const titleTextarea = modal.querySelector(".auto-resize-title");
const resizeTitle = () => {
  titleTextarea.style.height = "auto";
  const scrollHeight = Math.min(titleTextarea.scrollHeight, 90); // 90px — тот же лимит, что и в CSS
  titleTextarea.style.height = scrollHeight + "px";
};
resizeTitle();
titleTextarea.addEventListener("input", resizeTitle);


  // Выводим комментарии в контейнер
  const countElem = document.getElementById("comment-count");
if (countElem) {
  const current = parseInt(countElem.textContent) || 0;
  countElem.textContent = current + 1;
}


document.getElementById("comment-count").innerText = comments.length;

const commentsContainer = document.getElementById("comments-container");
commentsContainer.innerHTML = ""; // очищаем контейнер

if (comments.length === 0) {
  const emptyMsg = document.createElement("p");
  emptyMsg.textContent = "Комментариев пока нет...";
  emptyMsg.style.color = "#888";
  emptyMsg.style.fontStyle = "italic";
  emptyMsg.style.paddingLeft = "4px";
  commentsContainer.appendChild(emptyMsg);
}


comments.forEach(comment => {
  const commentDiv = document.createElement("div");
  commentDiv.className = "comment";
  commentDiv.innerHTML = `
    <strong>${comment.author_name || "Пользователь"}</strong>
    <p>${comment.text}</p>
  `;
  commentsContainer.appendChild(commentDiv);
});
scrollCommentsToBottom();

  // Приоритет — визуальная смена цвета
  modal.querySelectorAll('.priority-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      modal.querySelectorAll('.priority-dot').forEach(d => d.classList.remove('selected'));
      dot.classList.add('selected');
    });
  });

  // Кнопка сохранить
  const saveBtn = modal.querySelector(`#save-task-${taskId}`);
  if (saveBtn) {
    saveBtn.onclick = async () => {
      const title = modal.querySelector(`#task-title-${taskId}`).value;
      const due_date = modal.querySelector(`#task-due-${taskId}`).value;
      const description = modal.querySelector(`#task-desc-${taskId}`).value;
      const priority = modal.querySelector('.priority-dot.selected')?.dataset.value || 'medium';

    try {
      await axios.patch(`${API_BASE}/tasks/${taskId}/`, {
        title,
        due_date: due_date || null,
        description,
        priority
      });

      const taskCard = document.querySelector(`.task-card[data-task-id="${taskId}"]`);
if (taskCard) {
  taskCard.querySelector(".task-title").innerText = title;
  taskCard.querySelector(".task-date").innerText = due_date
    ? new Date(due_date).toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "long",
        year: "numeric"
      })
    : "не указана";

  const priorityColor = {
    low: "#4CAF50",
    medium: "#ffcc00",
    high: "#f44336"
  }[priority] || "#ffcc00";

  taskCard.querySelector(".priority-strip").style.backgroundColor = priorityColor;
}

modal.remove();

// Отправим WebSocket другим пользователям
if (window.boardSocket && window.boardSocket.readyState === WebSocket.OPEN) {
  window.boardSocket.send(JSON.stringify({ message: "reload" }));
}
} catch (err) {
    alert(err.response?.data?.error || "Недостаточно прав для редактирования задачи.");
  }
    };
  }

  // Кнопка удалить
  const deleteBtn = modal.querySelector(`#delete-task-${taskId}`);
  if (deleteBtn) {
    deleteBtn.onclick = async () => {
  const confirmDelete = confirm("Удалить эту задачу?");
  if (!confirmDelete) return;

  try {
    await axios.delete(`${API_BASE}/tasks/${taskId}/`);

    if (window.boardSocket && window.boardSocket.readyState === WebSocket.OPEN) {
      window.boardSocket.send(JSON.stringify({ message: "reload" }));
    }

    modal.remove();
    openBoard(currentBoardId);
  } catch (err) {
    alert(err.response?.data?.error || "Недостаточно прав для удаления задачи.");
  }
};
  }
};


createModals();

document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("access_token");
  const pendingInvite = localStorage.getItem("pending_invite");
  const params = new URLSearchParams(window.location.search);
  const inviteToken = params.get("invite");

  if (token) {
    axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

    try {
      // Приглашение через ссылку
      if (inviteToken) {
        await axios.get(`${API_BASE}/join/${inviteToken}/`);
        renderMainScreen();
        return;
      }

      // Было отложенное приглашение
      if (pendingInvite) {
        await axios.get(`${API_BASE}/join/${pendingInvite}/`);
        localStorage.removeItem("pending_invite");
        renderMainScreen();
        return;
      }

      // Если сохранена последняя доска
      const lastBoardId = localStorage.getItem("last_opened_board");
      if (lastBoardId) {
        await openBoard(lastBoardId);
        return;
      }

      // По умолчанию — главное меню
      await axios.get(`${API_BASE}/boards/`);
      renderMainScreen();
    } catch (error) {
      if (error.response && (error.response.status === 401 || error.response.status === 403)) {
        localStorage.removeItem("access_token");
        delete axios.defaults.headers.common["Authorization"];
        renderAuthScreen();
      } else {
        console.error(error);
      }
    }
  } else {
    // Пользователь не авторизован
    if (inviteToken) {
      localStorage.setItem("pending_invite", inviteToken);
    }
    renderAuthScreen();
  }
});
