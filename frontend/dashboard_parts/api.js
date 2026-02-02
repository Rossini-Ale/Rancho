const ApiService = {
  // Pega o token salvo no login
  getToken() {
    return localStorage.getItem("token");
  },

  // Gera os cabeçalhos padrão (JSON + Token)
  getHeaders() {
    const headers = {
      "Content-Type": "application/json",
    };
    const token = this.getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  },

  // Função genérica para tratar erros de resposta
  async handleResponse(response) {
    // Se der 401 (Não autorizado), o token venceu ou é inválido
    if (response.status === 401) {
      localStorage.removeItem("token"); // Limpa o token ruim
      window.location.href = "login.html"; // Manda pro login
      return null;
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Erro ${response.status}`);
    }

    // Se a resposta for vazia (ex: delete), retorna null
    if (response.status === 204) return null;

    return response.json();
  },

  // --- MÉTODOS HTTP ---

  async fetchData(endpoint) {
    try {
      const response = await fetch(endpoint, {
        method: "GET",
        headers: this.getHeaders(),
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error(`Erro GET ${endpoint}:`, error);
      // CORREÇÃO AQUI: Mudado de App para RanchoApp
      if (typeof RanchoApp !== "undefined") {
        RanchoApp.mostrarNotificacao("Erro de conexão.", "erro");
      }
      return null;
    }
  },

  async postData(endpoint, data) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(data),
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error(`Erro POST ${endpoint}:`, error);
      if (typeof RanchoApp !== "undefined") {
        RanchoApp.mostrarNotificacao("Erro ao salvar.", "erro");
      }
      throw error;
    }
  },

  async putData(endpoint, data) {
    try {
      const response = await fetch(endpoint, {
        method: "PUT",
        headers: this.getHeaders(),
        body: JSON.stringify(data),
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error(`Erro PUT ${endpoint}:`, error);
      if (typeof RanchoApp !== "undefined") {
        RanchoApp.mostrarNotificacao("Erro ao atualizar.", "erro");
      }
      throw error;
    }
  },

  async deleteData(endpoint) {
    try {
      const response = await fetch(endpoint, {
        method: "DELETE",
        headers: this.getHeaders(),
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error(`Erro DELETE ${endpoint}:`, error);
      if (typeof RanchoApp !== "undefined") {
        RanchoApp.mostrarNotificacao("Erro ao excluir.", "erro");
      }
      throw error;
    }
  },
};
