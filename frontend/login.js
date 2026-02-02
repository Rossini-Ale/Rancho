document
  .getElementById("formLogin")
  .addEventListener("submit", async (event) => {
    event.preventDefault();

    const btn = document.getElementById("btnEntrar");
    const msg = document.getElementById("msgErro");
    const usernameInput = document.getElementById("username");
    const passwordInput = document.getElementById("password");

    // Efeito visual de carregamento
    const textoOriginal = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML =
      '<span class="spinner-border spinner-border-sm me-2"></span>Entrando...';
    msg.classList.add("d-none");

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Envia 'username' e 'password' para a rota atualizada
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        // Salvar token
        if (data.token) {
          localStorage.setItem("token", data.token);
        }

        // Redirecionar
        window.location.href = "dashboard.html";
      } else {
        throw new Error(data.message || "Usuário ou senha incorretos.");
      }
    } catch (error) {
      console.error("Erro no login:", error);

      msg.textContent = error.message;
      msg.classList.remove("d-none");

      btn.disabled = false;
      btn.innerHTML = textoOriginal;

      // Vibrar se estiver no celular
      if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
    }
  });
