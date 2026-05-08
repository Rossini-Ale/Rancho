// ═══════════════════════════════════════════════════════════
// api.js — Serviço de requisições HTTP
// Coloque em frontend/api.js
// ═══════════════════════════════════════════════════════════

const ApiService = (() => {
  const getToken = () => localStorage.getItem("token");

  const headers = () => ({
    "Content-Type": "application/json",
    ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
  });

  // Processa resposta e lança erro com a mensagem do backend
  const handleResponse = async (res) => {
    if (res.ok) {
      const text = await res.text();
      return text ? JSON.parse(text) : null;
    }
    // Tenta pegar a mensagem de erro do backend
    let msg = `Erro ${res.status}`;
    try {
      const data = await res.json();
      if (data?.message) msg = data.message;
      else if (data?.error) msg = data.error;
    } catch (e) {}

    // Token expirado — redireciona para login
    if (res.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/";
      return;
    }

    throw new Error(msg);
  };

  return {
    async fetchData(url) {
      const res = await fetch(url, { headers: headers() });
      return handleResponse(res);
    },

    async postData(url, body) {
      const res = await fetch(url, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(body),
      });
      return handleResponse(res);
    },

    async putData(url, body) {
      const res = await fetch(url, {
        method: "PUT",
        headers: headers(),
        body: JSON.stringify(body),
      });
      return handleResponse(res);
    },

    async deleteData(url) {
      const res = await fetch(url, {
        method: "DELETE",
        headers: headers(),
      });
      return handleResponse(res);
    },
  };
})();
