import React, { useState } from "react";
import Login from "./components/Login";
import Register from "./components/Register";
import Dashboard from "./components/Dashboard";
import AdminPanel from "./components/AdminPanel";

function App() {
  const [page, setPage] = useState("login"); // login, register, dashboard, admin
  const [user, setUser] = useState(null);

  return (
    <div>
      {page === "login" && <Login setPage={setPage} setUser={setUser} />}
      {page === "register" && <Register setPage={setPage} />}
      {page === "dashboard" && <Dashboard user={user} setPage={setPage} />}
      {page === "admin" && <AdminPanel setPage={setPage} />}
    </div>
  );
}

export default App;
