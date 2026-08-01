let currentUser = null;

function loadUser() {
  const userStr = localStorage.getItem('faddel_user');
  if (userStr) {
    currentUser = JSON.parse(userStr);
  }
  return currentUser;
}

function saveUser(user) {
  currentUser = user;
  localStorage.setItem('faddel_user', JSON.stringify(user));
}

function logout() {
  localStorage.removeItem('faddel_token');
  localStorage.removeItem('faddel_user');
  currentUser = null;
  window.location.hash = '#/login';
}

function isLoggedIn() {
  return !!getToken();
}